// src/controllers/transactionController.js
const { query, pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for Deposit Screenshots ---
/*const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', '..', 'public', 'uploads');
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Sanitize filename if necessary, or use a UUID
        cb(null, `${req.user.id}-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, GIF allowed.'), false);
    }
};

exports.uploadScreenshot = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
}).single('screenshot'); // 'screenshot' is the field name in the form-data

exports.investInPlan = (req, res) => {
    const userId = req.user.id; // from protectUser middleware
    const originalUserBalance = req.user.balance; // Balance before this transaction
    const wasFirstInvestmentInitially = !req.user.hasMadeFirstInvestment; // State before this transaction
    const referredByOriginal = req.user.referredBy; // Referrer ID, if any, from before this transaction

    const { planId } = req.body;

    if (!planId) { // This check might be redundant if express-validator is used, but good for defense
        return res.status(400).json({ message: "Plan ID is required." });
    }
    const numericPlanId = parseInt(planId);
    if (isNaN(numericPlanId) || numericPlanId <=0) { // Also defensive
        return res.status(400).json({ message: "Valid Plan ID must be a positive integer."});
    }


    db.get("SELECT * FROM investment_plans WHERE id = ? AND isActive = TRUE", [numericPlanId], (err, plan) => {
        if (err) {
            console.error(`Error fetching plan details for investment (planId: ${numericPlanId}, userId: ${userId}):`, err.message);
            return res.status(500).json({ message: "Server error fetching plan details." });
        }
        if (!plan) {
            return res.status(404).json({ message: "Investment plan not found or is inactive." });
        }

        // Check if user has sufficient balance
        if (originalUserBalance < plan.investmentAmount) {
            return res.status(400).json({ message: `Insufficient balance. You need ${plan.investmentAmount.toFixed(2)} PKR. Your current balance is ${originalUserBalance.toFixed(2)} PKR.` });
        }

        // Check if user already has an active plan (simple model: one active plan at a time)
        if (req.user.activePlanId && req.user.activePlanId !== 0 && req.user.activePlanId !== null) { // Check if activePlanId is truthy and not explicitly 0 or null
             return res.status(400).json({ message: "You already have an active investment plan. Please wait for it to complete before investing in another." });
        }

        // Use a transaction to ensure atomicity (all or nothing)
        db.serialize(() => {
            db.run("BEGIN TRANSACTION;", (dbErr) => {
                if (dbErr) {
                    console.error("Begin transaction error for investment:", dbErr.message);
                    return res.status(500).json({ message: "Database transaction error." });
                }

                // 1. Deduct balance, set active plan, set first investment flag, AND SET lastCheckIn
                const newBalanceAfterInvestment = originalUserBalance - plan.investmentAmount;
                const investmentTime = new Date().toISOString(); // Time of investment

                db.run("UPDATE users SET balance = ?, activePlanId = ?, hasMadeFirstInvestment = TRUE, lastCheckIn = ? WHERE id = ?",
                    [newBalanceAfterInvestment, plan.id, investmentTime, userId], function(updateErr) {
                    if (updateErr) {
                        db.run("ROLLBACK;");
                        console.error(`Error updating user (balance/plan/lastCheckIn) for investment (userId: ${userId}):`, updateErr.message);
                        return res.status(500).json({ message: "Failed to process investment (user update)." });
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK;");
                        console.warn(`User ${userId} not found during investment update, or no changes made.`);
                        return res.status(404).json({ message: "User not found for investment processing." });
                    }

                    // 2. Record investment transaction for the current user
                    const investmentTransactionDescription = `Invested in ${plan.name}`;
                    db.run("INSERT INTO transactions (userId, type, amount, status, description, method) VALUES (?, 'Investment', ?, 'Completed', ?, 'Platform')",
                        [userId, plan.investmentAmount, investmentTransactionDescription], function(transErr) {
                        if (transErr) {
                            db.run("ROLLBACK;");
                            console.error(`Error recording investment transaction for user ${userId}:`, transErr.message);
                            return res.status(500).json({ message: "Failed to process investment (transaction record)." });
                        }

                        let tasksCompleted = 0;
                        const totalTasks = (wasFirstInvestmentInitially && referredByOriginal) ? 1 : 0; // Only 1 potential async task (referral bonus)
                        let finalCommitDone = false;

                        const checkAndCommit = () => {
                            if (finalCommitDone) return; // Prevent multiple commits
                            if (tasksCompleted >= totalTasks) {
                                db.run("COMMIT;", (commitErr) => {
                                    if (commitErr) {
                                        finalCommitDone = true; // Mark as done even on error to prevent re-entry
                                        db.run("ROLLBACK;"); // Attempt rollback
                                        console.error("Commit error during investment processing:", commitErr.message);
                                        // Avoid sending another response if one might have been sent
                                        if (!res.headersSent) {
                                            return res.status(500).json({ message: "Failed to finalize investment."});
                                        }
                                        return;
                                    }
                                    finalCommitDone = true;
                                    if (!res.headersSent) {
                                        res.json({
                                            message: `Successfully invested in ${plan.name}. Your new balance is ${newBalanceAfterInvestment.toFixed(2)} PKR.`,
                                            newBalance: newBalanceAfterInvestment,
                                            activePlanName: plan.name
                                        });
                                    }
                                });
                            }
                        };


                        // 3. Handle Referral Bonus (if applicable for this investment)
                        if (wasFirstInvestmentInitially && referredByOriginal) {
                            const investmentAmountOfThisUser = plan.investmentAmount;
                            const REFERRAL_PERCENTAGE = 0.10; // 10%
                            const calculatedReferralBonus = parseFloat((investmentAmountOfThisUser * REFERRAL_PERCENTAGE).toFixed(2));
                            const referrerId = referredByOriginal;

                            console.log(`User ${userId} (referred by ${referrerId}) made first investment of ${investmentAmountOfThisUser}. Referrer gets ${REFERRAL_PERCENTAGE * 100}% bonus: ${calculatedReferralBonus}`);

                            db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [calculatedReferralBonus, referrerId], (bonusUpdateErr) => {
                                if (bonusUpdateErr) {
                                    console.error(`Error giving ${calculatedReferralBonus} referral bonus to referrer ${referrerId}:`, bonusUpdateErr.message);
                                    // This is non-critical to the main investment, so we don't rollback the entire transaction.
                                    // We just log the error and proceed.
                                } else {
                                    db.run("INSERT INTO transactions (userId, type, amount, status, description, method) VALUES (?, 'Referral Bonus', ?, 'Completed', ?, 'Platform')",
                                    [referrerId, calculatedReferralBonus, `Referral bonus (${REFERRAL_PERCENTAGE * 100}%) for ${req.user.name} (User ID: ${userId}) investing ${investmentAmountOfThisUser.toFixed(2)} PKR`], (bonusTransErr) => {
                                        if (bonusTransErr) console.error("Error recording referral bonus transaction:", bonusTransErr.message);
                                        else console.log(`Referral bonus of ${calculatedReferralBonus} PKR given to user ${referrerId} for referral of ${req.user.name}`);
                                    });
                                }
                                tasksCompleted++;
                                checkAndCommit(); // Check if it's time to commit
                            });
                        } else {
                            // If no referral bonus to process, we can commit directly
                            checkAndCommit();
                        }
                        // Note: If you add a "Welcome Bonus" for the referred friend, that would be another async operation
                        // to manage before the final commit, and totalTasks would need to account for it.

                    }); // End of db.run for recording investment transaction
                }); // End of db.run for updating user
            }); // End of db.run for BEGIN TRANSACTION
        }); // End of db.serialize
    }); // End of db.get for fetching plan details
};

// Other transaction functions (deposit, withdraw, history) will go here
// User requests a deposit
exports.requestDeposit = (req, res) => {
    const userId = req.user.id;
    const { amount, method, transactionId: transactionIdExternal } = req.body; // 'transactionId' from form is 'transactionIdExternal' in DB

    const depositAmount = parseFloat(amount);
    const screenshotUrl = `/uploads/${req.file.filename}`; // Relative path to serve the file

    const sql = `INSERT INTO transactions (userId, type, amount, status, method, transactionIdExternal, screenshotUrl, description)
                 VALUES (?, 'Deposit', ?, 'Pending', ?, ?, ?, ?)`;
    const description = `User deposit request via ${method}. TID: ${transactionIdExternal}`;

    db.run(sql, [userId, depositAmount, method, transactionIdExternal, screenshotUrl, description], function(err) {
        if (err) {
            console.error(`Error creating deposit request for user ${userId}:`, err.message);
            // If DB error, try to remove uploaded file to prevent orphaned files (optional)
            try {
                fs.unlinkSync(req.file.path);
                console.log(`Cleaned up uploaded file due to DB error: ${req.file.path}`);
            } catch (unlinkErr) {
                console.error(`Error cleaning up file ${req.file.path}:`, unlinkErr.message);
            }
            return res.status(500).json({ message: "Could not submit deposit request." });
        }
        res.status(201).json({
            message: "Deposit request submitted successfully and is pending approval.",
            transactionId: this.lastID,
            details: { amount: depositAmount, method, transactionIdExternal, screenshotUrl }
        });
    });
};

// User requests a withdrawal
exports.requestWithdrawal = async (req, res) => {
    const userId = req.user.id;
    const userBalance = req.user.balance; // Get current balance from req.user
    const { amount, method, accountNumber } = req.body;

    // For now, a simple minimum withdrawal, you can make this configurable
    const withdrawalAmount = parseFloat(amount);
    const MINIMUM_WITHDRAWAL = 500; // Example
    if (withdrawalAmount < MINIMUM_WITHDRAWAL) {
        return res.status(400).json({ message: `Minimum withdrawal amount is ${MINIMUM_WITHDRAWAL.toFixed(2)} PKR.` });
    }
     try {
        const activeReferralCount = await new Promise((resolve, reject) => {
            // Count users who were referred by the current user AND have made their first investment
            const sqlCheckReferral = `
                SELECT COUNT(*) as count
                FROM users
                WHERE referredBy = ? AND hasMadeFirstInvestment = TRUE
            `;
            db.get(sqlCheckReferral, [userId], (err, row) => {
                if (err) {
                    console.error(`Error checking active referrals for user ${userId}:`, err.message);
                    return reject(new Error("Database error checking referrals.")); // Generic error to user
                }
                resolve(row ? row.count : 0);
            });
        });

        if (activeReferralCount < 1) {
            return res.status(403).json({ // 403 Forbidden - they are authenticated but not authorized for this action yet
                message: "Withdrawal requirement not met: You need at least one referred user who has made an investment."
            });
        }

    // Optional: Add withdrawal limits, fees, etc. later

    const sql = `INSERT INTO transactions (userId, type, amount, status, method, accountNumber, description)
                VALUES ($1, 'Deposit', $2, 'Pending', $3, $4, $5, $6) RETURNING id`;
    const description = `User withdrawal request to ${accountNumber.trim()} via ${method}.`;

    db.run(sql, [userId, withdrawalAmount, method, accountNumber.trim(), description], function(err) {
        if (err) {
            console.error(`Error creating withdrawal request for user ${userId}:`, err.message);
            return res.status(500).json({ message: "Could not submit withdrawal request." });
        }
        // IMPORTANT: Balance is NOT deducted here. It's deducted by an admin upon approval.
        res.status(201).json({
            message: "Withdrawal request submitted successfully and is pending approval.",
            transactionId: this.lastID,
            details: { amount: withdrawalAmount, method, accountNumber: accountNumber.trim() }
        });
    });
   } catch (error) { // Catch errors from the new Promise (activeReferralCount)
        console.error(`Server error during withdrawal request for user ${userId}:`, error.message);
        return res.status(500).json({ message: error.message || "Server error during withdrawal processing." });
    }
};

// User gets their transaction history
exports.getTransactionHistory = (req, res) => {
    const userId = req.user.id;

    // You can add pagination later if needed (e.g., using LIMIT and OFFSET)
    // Sorting by timestamp descending to show the latest transactions first
    const sql = `SELECT id, type, amount, status, description, method, accountNumber, transactionIdExternal, screenshotUrl, timestamp
                 FROM transactions
                 WHERE userId = ?
                 ORDER BY timestamp DESC`;

    db.all(sql, [userId], (err, transactions) => {
        if (err) {
            console.error(`Error fetching transaction history for user ${userId}:`, err.message);
            return res.status(500).json({ message: "Could not retrieve transaction history." });
        }

        // Optionally, format data before sending (e.g., date formatting, though frontend can also do this)
        // For screenshotUrl, ensure it's a full or correctly relative path if needed by frontend
        // Currently, it's stored as /uploads/filename.ext which should work if frontend prepends the base API URL.

        res.json({
            message: "Transaction history fetched successfully.",
            data: transactions
        });
    });
};*/
// --- Multer Setup (No DB calls, no change needed) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', '..', 'public', 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, `${req.user.id}-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, GIF allowed.'), false);
    }
};
exports.uploadScreenshot = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter }).single('screenshot');


// --- User Invests in a Plan ---
exports.investInPlan = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const originalUser = req.user; // User state before this transaction
        const { planId } = req.body;
        const numericPlanId = parseInt(planId);

        const planResult = await query("SELECT * FROM investment_plans WHERE id = $1 AND isActive = TRUE", [numericPlanId]);
        const plan = planResult.rows[0];

        if (!plan) {
            return res.status(404).json({ message: "Investment plan not found or is inactive." });
        }

        if (originalUser.balance < plan.investmentamount) { // Note pg returns lowercase
            return res.status(400).json({ message: `Insufficient balance. You need ${plan.investmentamount.toFixed(2)} PKR.` });
        }

        if (originalUser.activeplanid) {
            return res.status(400).json({ message: "You already have an active investment plan." });
        }

        await client.query('BEGIN');

        const newBalance = originalUser.balance - plan.investmentamount;
        const investmentTime = new Date();
        await client.query("UPDATE users SET balance = $1, activePlanId = $2, hasMadeFirstInvestment = TRUE, lastCheckIn = $3 WHERE id = $4", [newBalance, plan.id, investmentTime, userId]);

        await client.query("INSERT INTO transactions (userId, type, amount, status, description, method) VALUES ($1, 'Investment', $2, 'Completed', $3, 'Platform')", [userId, plan.investmentamount, `Invested in ${plan.name}`]);

        // Referral Bonus Logic
        if (!originalUser.hasmadefirstinvestment && originalUser.referredby) {
            const REFERRAL_PERCENTAGE = 0.10; // 10%
            const calculatedBonus = parseFloat((plan.investmentamount * REFERRAL_PERCENTAGE).toFixed(2));
            const referrerId = originalUser.referredby;
            await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [calculatedBonus, referrerId]);
            await client.query("INSERT INTO transactions (userId, type, amount, status, description, method) VALUES ($1, 'Referral Bonus', $2, 'Completed', $3, 'Platform')", [referrerId, calculatedBonus, `Referral bonus (10%) for ${originalUser.name} investing`]);
        }
        
        await client.query('COMMIT');
        
        res.json({ message: `Successfully invested in ${plan.name}. Your new balance is ${newBalance.toFixed(2)} PKR.`, newBalance, activePlanName: plan.name });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("INVEST_IN_PLAN_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Server error during investment process." });
    } finally {
        client.release();
    }
};


// --- User Requests a Deposit ---
exports.requestDeposit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, method, transactionId: transactionIdExternal } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Payment screenshot is required." });
        }

        const depositAmount = parseFloat(amount);
        const screenshotUrl = `/uploads/${req.file.filename}`;
        const description = `User deposit request via ${method}. TID: ${transactionIdExternal}`;
        
        const sql = `INSERT INTO transactions (userId, type, amount, status, method, transactionIdExternal, screenshotUrl, description) VALUES ($1, 'Deposit', $2, 'Pending', $3, $4, $5, $6) RETURNING id`;
        const { rows } = await query(sql, [userId, depositAmount, method, transactionIdExternal, screenshotUrl, description]);

        res.status(201).json({ message: "Deposit request submitted successfully and is pending approval.", transactionId: rows[0].id, details: { amount, method, transactionIdExternal } });

    } catch (error) {
        console.error("REQUEST_DEPOSIT_ERROR:", error.message, error.stack);
        if (req.file) { // Attempt to clean up uploaded file on DB error
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "Could not submit deposit request." });
    }
};


// --- User Requests a Withdrawal ---
exports.requestWithdrawal = async (req, res) => {
    try {
        const userId = req.user.id;
        const userBalance = req.user.balance;
        const { amount, method, accountNumber } = req.body;
        const withdrawalAmount = parseFloat(amount);

        if (userBalance < withdrawalAmount) {
            return res.status(400).json({ message: `Insufficient balance.` });
        }
        
        const MINIMUM_WITHDRAWAL = 100;
        if (withdrawalAmount < MINIMUM_WITHDRAWAL) {
            return res.status(400).json({ message: `Minimum withdrawal amount is ${MINIMUM_WITHDRAWAL} PKR.` });
        }

        // Referral condition check
        const referralCheckResult = await query("SELECT COUNT(*) as count FROM users WHERE referredBy = $1 AND hasMadeFirstInvestment = TRUE", [userId]);
        const activeReferralCount = parseInt(referralCheckResult.rows[0].count);
        if (activeReferralCount < 1) {
            return res.status(403).json({ message: "Withdrawal requirement not met: You need at least one referred user who has made an investment." });
        }

        const description = `User withdrawal request to ${accountNumber.trim()} via ${method}.`;
        const sql = `INSERT INTO transactions (userId, type, amount, status, method, accountNumber, description) VALUES ($1, 'Withdrawal', $2, 'Pending', $3, $4, $5) RETURNING id`;
        const { rows } = await query(sql, [userId, withdrawalAmount, method, accountNumber.trim(), description]);

        res.status(201).json({ message: "Withdrawal request submitted successfully and is pending approval.", transactionId: rows[0].id });

    } catch (error) {
        console.error("REQUEST_WITHDRAWAL_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not submit withdrawal request." });
    }
};

// --- Get User Transaction History ---
exports.getTransactionHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const sql = `SELECT id, type, amount, status, description, method, accountNumber, transactionIdExternal, screenshotUrl, timestamp FROM transactions WHERE userId = $1 ORDER BY timestamp DESC`;
        const { rows } = await query(sql, [userId]);
        res.json({ message: "Transaction history fetched successfully.", data: rows });
    } catch (error) {
        console.error("GET_HISTORY_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve transaction history." });
    }
};
