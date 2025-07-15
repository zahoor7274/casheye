const { query, pool } = require('../config/database');
const bcrypt = require('bcryptjs');

/*exports.getUserProfile = (req, res) => {
    if (!req.user) {
        return res.status(404).json({ message: "User profile not found in request." });
    }
    res.json({
        message: "User profile fetched successfully.",
        data: req.user
    });
};

exports.getCheckInStatus = async (req, res) => {
    const userId = req.user.id;
    const user = req.user;

    try {
        if (!user.activePlanId) {
            return res.json({
                message: "You need an active investment plan to perform daily check-ins.",
                canCheckIn: false,
                hasActivePlan: false
            });
        }

        const plan = await new Promise((resolve, reject) => {
            db.get("SELECT dailyReturn FROM investment_plans WHERE id = ?", [user.activePlanId], (err, row) => {
                if (err) {
                    console.error("DB error fetching plan for check-in status:", err.message);
                    return reject(err);
                }
                resolve(row);
            });
        });

        if (!plan) {
            console.warn(`User ${userId} has activePlanId ${user.activePlanId} but plan details not found.`);
            return res.status(404).json({
                message: "Active investment plan details not found. Please contact support.",
                canCheckIn: false,
                hasActivePlan: true
            });
        }

        const dailyProfit = plan.dailyReturn;
        let canCheckIn = false;
        let nextCheckInAt = null;
        let message = "";

        if (!user.lastCheckIn) {
            canCheckIn = true;
            message = "You are eligible for your daily check-in.";
        } else {
            const lastCheckInTime = new Date(user.lastCheckIn);
            const now = new Date();

            lastCheckInTime.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);

            if (now > lastCheckInTime) {
                canCheckIn = true;
                message = "You are eligible for your daily check-in.";
            } else {
                const tomorrow = new Date(lastCheckInTime);
                tomorrow.setDate(lastCheckInTime.getDate() + 1);
                nextCheckInAt = tomorrow.toISOString();
                message = "You have already claimed your earnings for today.";
            }
        }

        res.json({
            message,
            canCheckIn,
            nextCheckInAt,
            dailyProfit: canCheckIn ? dailyProfit : null,
            lastCheckIn: user.lastCheckIn,
            hasActivePlan: true
        });

    } catch (error) {
        console.error(`Error getting check-in status for user ${userId}:`, error.message);
        res.status(500).json({ message: "Server error while checking status." });
    }
};
exports.performCheckIn = async (req, res) => {
    const userId = req.user.id;
    const user = req.user;

    try {
        // --- Initial checks (same as before) ---
        if (!user.activePlanId) {
            return res.status(400).json({ message: "You need an active investment plan to perform daily check-ins." });
        }

        const plan = await new Promise((resolve, reject) => {
            db.get("SELECT dailyReturn FROM investment_plans WHERE id = ?", [user.activePlanId], (err, row) => {
                if (err) {
                    console.error("DB error fetching plan for performing check-in (outer):", err.message);
                    return reject(new Error("Failed to fetch plan details."));
                }
                resolve(row);
            });
        });

        if (!plan) {
            console.warn(`User ${userId} trying to check-in with activePlanId ${user.activePlanId} but plan details not found.`);
            return res.status(404).json({ message: "Active investment plan details not found." });
        }

        let canCheckIn = false;
        if (!user.lastCheckIn) {
            canCheckIn = true;
        } else {
            const lastCheckInTime = new Date(user.lastCheckIn);
            const now = new Date();
            lastCheckInTime.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            if (now > lastCheckInTime) {
                canCheckIn = true;
            }
        }

        if (!canCheckIn) {
            return res.status(400).json({ message: "You have already claimed your earnings for today or are not eligible yet." });
        }

        const dailyProfit = plan.dailyReturn;
        const newBalance = user.balance + dailyProfit;
        const currentTimeForDb = new Date().toISOString();

        // --- Explicit Transaction Control ---
        db.run("BEGIN IMMEDIATE TRANSACTION;", (beginErr) => { // Using BEGIN IMMEDIATE for a write lock
            if (beginErr) {
                console.error(`Check-in: BEGIN TRANSACTION error for user ${userId}:`, beginErr.message);
                return res.status(500).json({ message: "Database transaction error (begin)." });
            }

            let rolledBack = false; // Flag to prevent multiple responses

            const rollback = (errMsgForClient, logMsg, originalErr) => {
                if (rolledBack) return;
                rolledBack = true;
                db.run("ROLLBACK;", (rbErr) => {
                    if (rbErr) console.error(`Check-in: ROLLBACK error for user ${userId} (after: ${logMsg}):`, rbErr.message);
                    else console.log(`Check-in: Transaction ROLLED BACK for user ${userId} (after: ${logMsg})`);
                });
                console.error(`Check-in: ${logMsg} for user ${userId}:`, originalErr ? originalErr.message : "Unknown error");
                return res.status(500).json({ message: errMsgForClient });
            };

            // 1. Update user's balance
            db.run("UPDATE users SET balance = ?, lastCheckIn = ? WHERE id = ?",
                [newBalance, currentTimeForDb, userId], function(updateErr) {
                if (rolledBack) return; // If already rolled back, do nothing
                if (updateErr) {
                    return rollback("Failed to process check-in (user update).", "Error updating user", updateErr);
                }
                if (this.changes === 0) {
                    return rollback("User not found for check-in.", "User not found or no changes made during update", null);
                }

                // 2. Insert transaction record
                const transSql = `INSERT INTO transactions (userId, type, amount, status, description, method)
                                  VALUES (?, 'Daily Earnings', ?, 'Completed', ?, 'Platform')`;
                db.run(transSql, [userId, dailyProfit, `Daily earnings from active plan`], function(insertErr) {
                    if (rolledBack) return;
                    if (insertErr) {
                        return rollback("Failed to process check-in (transaction record).", "Error recording transaction", insertErr);
                    }

                    // 3. Commit the transaction
                    db.run("COMMIT;", (commitErr) => {
                        if (rolledBack) return; // Should not happen if commit is reached without prior error
                        if (commitErr) {
                            // Rollback might not be possible if commit itself fails badly, but attempt
                            return rollback("Failed to finalize check-in.", "Error committing transaction", commitErr);
                        }
                        console.log(`Check-in: Transaction for user ${userId} COMMITTED successfully.`);
                        res.json({
                            message: `Successfully claimed ${dailyProfit.toFixed(2)} PKR. Your new balance is ${newBalance.toFixed(2)} PKR.`,
                            newBalance: newBalance,
                            dailyProfitEarned: dailyProfit
                        });
                    }); // End of COMMIT callback
                }); // End of INSERT transaction callback
            }); // End of UPDATE user callback
        }); // End of BEGIN TRANSACTION callback

    } catch (error) { // This outer try-catch handles errors from `await new Promise` or other synchronous code before DB ops
        console.error(`Outer error performing check-in for user ${userId} (before BEGIN TRANSACTION):`, error.message, error.stack);
        res.status(500).json({ message: "Server error during check-in process." });
    }
};

// Change User Password
// Change User Password
exports.changePassword = async (req, res) => {
    const userId = req.user.id; // From protectUser middleware
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required." });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    if (currentPassword === newPassword) {
        return res.status(400).json({ message: "New password cannot be the same as the current password." });
    }

    try {
        // Fetch the user's current hashed password from the database
        const userWithPassword = await new Promise((resolve, reject) => {
            db.get("SELECT password FROM users WHERE id = ?", [userId], (err, row) => {
                if (err) {
                    console.error(`Error fetching user password for change for user ${userId}:`, err.message);
                    return reject(err);
                }
                resolve(row);
            });
        });

        if (!userWithPassword) {
            // This should not happen if protectUser middleware worked, but good for robustness
            return res.status(404).json({ message: "User not found." });
        }

        // Compare the provided currentPassword with the stored hashed password
        const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect current password." });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        db.run("UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
            [hashedNewPassword, userId], function(err) {
            if (err) {
                console.error(`Error updating password for user ${userId}:`, err.message);
                return res.status(500).json({ message: "Could not update password." });
            }
            if (this.changes === 0) {
                 console.warn(`Password update attempted for user ${userId} but no rows changed.`);
                 return res.status(404).json({ message: "User not found for password update." });
            }

            res.json({ message: "Password changed successfully." });
        });

    } catch (error) {
        console.error(`Server error during password change for user ${userId}:`, error.message);
        res.status(500).json({ message: "Server error while changing password." });
    }
};



// Get users referred by the logged-in user
exports.getReferrals = (req, res) => {
    const referrerUserId = req.user.id; // The ID of the user making the request (the referrer)
        const sql = `SELECT id, name, email, createdAt AS signupDate, hasMadeFirstInvestment
                 FROM users
                 WHERE referredBy = ?
                 ORDER BY createdAt DESC`; // Show newest referrals first

        db.all(sql, [referrerUserId], (err, referredUsers) => {
            if (err) {
                console.error(`Error fetching referrals for user ${referrerUserId}:`, err.message);
                return res.status(500).json({ message: "Could not retrieve your referrals." });
            }

        res.json({
            message: "Your referred users fetched successfully.",
            data: referredUsers
            });
        });
};*/


// --- Get User Profile ---
exports.getUserProfile = (req, res) => {
    if (!req.user) {
        return res.status(404).json({ message: "User profile not found in request." });
    }
    res.json({
        message: "User profile fetched successfully.",
        data: req.user
    });
};

// --- Get Daily Check-in Status ---
exports.getCheckInStatus = async (req, res) => {
    try {
        const user = req.user;

        if (!user.activeplanid) { // Note: pg returns lowercase column names
            return res.json({ message: "You need an active investment plan to perform daily check-ins.", canCheckIn: false, hasActivePlan: false });
        }

        const { rows } = await query("SELECT dailyreturn FROM investment_plans WHERE id = $1", [user.activeplanid]);
        const plan = rows[0];

        if (!plan) {
            return res.status(404).json({ message: "Active investment plan details not found.", canCheckIn: false, hasActivePlan: true });
        }

        const dailyProfit = plan.dailyreturn;
        let canCheckIn = false;
        let nextCheckInAt = null;
        let message = "";

        const lastCheckInTime = user.lastcheckin ? new Date(user.lastcheckin) : null;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (!lastCheckInTime || lastCheckInTime < startOfToday) {
            canCheckIn = true;
            message = "You are eligible for your daily check-in.";
        } else {
            const startOfTomorrow = new Date(startOfToday);
            startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
            nextCheckInAt = startOfTomorrow.toISOString();
            message = "You have already claimed your earnings for today.";
        }
        
        res.json({ message, canCheckIn, nextCheckInAt, dailyProfit: canCheckIn ? dailyProfit : null, lastCheckIn: user.lastcheckin, hasActivePlan: true });

    } catch (error) {
        console.error("GET_CHECK_IN_STATUS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Server error while checking status." });
    }
};


// --- Perform Daily Check-in ---
exports.performCheckIn = async (req, res) => {
    const client = await pool.connect(); // Get a client for transaction
    try {
        const user = req.user;
        const userId = user.id;

        if (!user.activeplanid) {
            return res.status(400).json({ message: "You need an active investment plan to perform daily check-ins." });
        }

        const planResult = await query("SELECT dailyreturn FROM investment_plans WHERE id = $1", [user.activeplanid]);
        const plan = planResult.rows[0];

        if (!plan) {
            return res.status(404).json({ message: "Active investment plan details not found." });
        }
        
        const lastCheckInTime = user.lastcheckin ? new Date(user.lastcheckin) : null;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (lastCheckInTime && lastCheckInTime >= startOfToday) {
            return res.status(400).json({ message: "You have already claimed your earnings for today." });
        }

        const dailyProfit = plan.dailyreturn;
        const newBalance = user.balance + dailyProfit;
        const currentTimeForDb = new Date();

        await client.query('BEGIN');

        await client.query("UPDATE users SET balance = $1, lastCheckIn = $2 WHERE id = $3", [newBalance, currentTimeForDb, userId]);
        
        const transSql = `INSERT INTO transactions (userId, type, amount, status, description, method) VALUES ($1, 'Daily Earnings', $2, 'Completed', $3, 'Platform')`;
        await client.query(transSql, [userId, dailyProfit, 'Daily earnings from active plan']);
        
        await client.query('COMMIT');
        
        res.json({ message: `Successfully claimed ${dailyProfit.toFixed(2)} PKR. Your new balance is ${newBalance.toFixed(2)} PKR.`, newBalance, dailyProfitEarned: dailyProfit });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("PERFORM_CHECK_IN_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Server error during check-in." });
    } finally {
        client.release();
    }
};


// --- Change User Password ---
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const { rows } = await query("SELECT password FROM users WHERE id = $1", [userId]);
        const userWithPassword = rows[0];

        if (!userWithPassword) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect current password." });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        await query("UPDATE users SET password = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2", [hashedNewPassword, userId]);
        
        res.json({ message: "Password changed successfully." });

    } catch (error) {
        console.error("CHANGE_PASSWORD_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Server error while changing password." });
    }
};

// --- Get User Referrals ---
exports.getReferrals = async (req, res) => {
    try {
        const referrerUserId = req.user.id;
        const sql = `
            SELECT id, name, email, createdAt AS signupDate, hasMadeFirstInvestment
            FROM users WHERE referredBy = $1 ORDER BY createdAt DESC
        `;
        const { rows } = await query(sql, [referrerUserId]);

        res.json({ message: "Your referred users fetched successfully.", data: rows });

    } catch (error) {
        console.error("GET_REFERRALS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve your referrals." });
    }
};