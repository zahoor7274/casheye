//const { db } = require('../config/database');
const { query } = require('../config/database');
/*const { query } = require('../config/database');

// List all users with optional search
exports.listUsers = (req, res) => {
    try {
        const searchTerm = req.query.search || ''; // Get search term from query params

    // Basic query, ordered by name.
    // We select fields relevant for the admin user listing table.
        let sql = `SELECT id, name, email, balance, status, createdAt
                   FROM users`;
        const params = [];

        if (searchTerm) {
            // Add WHERE clause for searching name or email
            // Using SQLite's LIKE operator, % is a wildcard
            sql += ` WHERE (name LIKE ? OR email LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        sql += ` ORDER BY createdAt DESC`; // Show newest users first, or by name: ORDER BY name ASC
        const { rows } = await query(sql, params);
        res.json({ message: "Users listed successfully.", data: rows });
    } catch (err) {
        // 6. The catch block handles any errors
        console.error("Error listing users for admin:", err.message);
        res.status(500).json({ message: "Failed to retrieve user list." });
    }
};

// Placeholder for other admin user management functions
exports.getUserProfileForAdmin = async (req, res) => {
    const { userId } = req.params; // Get userId from URL parameter

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ message: "Valid User ID is required." });
    }
    const numericUserId = parseInt(userId);

    try {
        // Fetch user basic details
        const userPromise = new Promise((resolve, reject) => {
            // Also fetch referredByEmail if possible (JOIN with users table on users.referredBy = referrer.id)
            // and activePlanName (JOIN with investment_plans table)
            db.get(`
                SELECT u.id, u.name, u.email, u.balance, u.status, u.referralCode, u.lastCheckIn,
                       u.hasMadeFirstInvestment, u.createdAt,
                       r.email as referredByEmail,
                       p.name as activePlanName
                FROM users u
                LEFT JOIN users r ON u.referredBy = r.id
                LEFT JOIN investment_plans p ON u.activePlanId = p.id
                WHERE u.id = ?
            `, [numericUserId], (err, user) => {
                if (err) reject(err);
                resolve(user);
            });
        });

        // Fetch user's transaction history
        const transactionsPromise = new Promise((resolve, reject) => {
            db.all("SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC", [numericUserId], (err, transactions) => {
                if (err) reject(err);
                resolve(transactions);
            });
        });

        // Fetch users referred by this user (referralsMade)
        const referralsMadePromise = new Promise((resolve, reject) => {
            db.all("SELECT id, name, email, createdAt AS signupDate FROM users WHERE referredBy = ? ORDER BY createdAt DESC", [numericUserId], (err, referrals) => {
                if (err) reject(err);
                resolve(referrals);
            });
        });

        const [user, transactions, referralsMade] = await Promise.all([
            userPromise,
            transactionsPromise,
            referralsMadePromise
        ]);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({
            message: "User profile details fetched successfully.",
            data: {
                ...user, // Spread basic user details
                transactions: transactions || [],
                referralsMade: referralsMade || []
            }
        });

    } catch (error) {
        console.error(`Error fetching profile for user ${numericUserId} by admin:`, error.message);
        res.status(500).json({ message: "Failed to retrieve user profile details." });
    }
};

// ... (keep listUsers, getUserProfileForAdmin, blockUser, unblockUser)

exports.updateUserProfileByAdmin = (req, res) => {
    const { userId } = req.params;
    const numericUserId = parseInt(userId);
    const { name, status } = req.body; // Only take name and status

    if (isNaN(numericUserId)) {
        return res.status(400).json({ message: "Invalid User ID." });
    }

    if (!name || !status) {
        return res.status(400).json({ message: "Name and status are required." });
    }
    if (!['Active', 'Blocked'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value. Must be 'Active' or 'Blocked'."});
    }

    // WARNING: Intentionally ignoring 'balance' if sent from frontend.
    // Balance should be managed via audited transactions.
    if (req.body.balance !== undefined) {
        console.warn(`Admin (ID: ${req.admin.id}) attempted to update balance for user ${numericUserId} via profile edit. This is disallowed. Only name/status updated.`);
    }

    db.run("UPDATE users SET name = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        [name, status, numericUserId], function(err) {
        if (err) {
            console.error(`Error updating profile for user ${numericUserId} by admin:`, err.message);
            return res.status(500).json({ message: "Failed to update user profile." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "User not found or no changes made." });
        }
        res.json({ message: `User ${numericUserId}'s profile updated successfully (name/status only).` });
    });
};
// ... (keep listUsers, getUserProfileForAdmin)

exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId);

        if (isNaN(numericUserId)) {
            return res.status(400).json({ message: "Invalid User ID." });
        }

        // Optional: Prevent admin from blocking themselves or other critical accounts
        // if (numericUserId === req.admin.id && some_condition_for_admin_user_table) {
        // return res.status(403).json({ message: "Cannot block this account." });
        // }

        const sql = "UPDATE users SET status = 'Blocked' WHERE id = $1";
            
            const result = await query(sql, [userId]);

            // 'pg' result object has 'rowCount' which is equivalent to 'changes'
            if (result.rowCount === 0) { 
                return res.status(404).json({ message: "User not found." });
            }
            
            res.json({ message: `User ${userId} blocked successfully.` });
        } catch (err) {
            // ... handle error
    }
};
// ... (keep listUsers, getUserProfileForAdmin, blockUser)

exports.unblockUser = (req, res) => {
    const { userId } = req.params;
    const numericUserId = parseInt(userId);

     if (isNaN(numericUserId)) {
        return res.status(400).json({ message: "Invalid User ID." });
    }

    db.run("UPDATE users SET status = 'Active', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", [numericUserId], function(err) {
        if (err) {
            console.error(`Error unblocking user ${numericUserId}:`, err.message);
            return res.status(500).json({ message: "Failed to unblock user." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ message: `User ${numericUserId} unblocked successfully.` });
    });
};*/
// List all users with optional search
exports.listUsers = async (req, res) => {
    try {
        const searchTerm = req.query.search || '';
        let sql = `SELECT id, name, email, balance, status, createdAt FROM users`;
        const params = [];

        if (searchTerm) {
            sql += ` WHERE (name ILIKE $1 OR email ILIKE $1)`; // Use ILIKE for case-insensitive search
            params.push(`%${searchTerm}%`);
        }

        sql += ` ORDER BY createdAt DESC`;

        const { rows } = await query(sql, params);
        res.json({ message: "Users listed successfully.", data: rows });
    } catch (error) {
        console.error("ADMIN_LIST_USERS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve user list." });
    }
};

// Get a specific user's full profile for admin view
exports.getUserProfileForAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId);

        const userSql = `
            SELECT u.id, u.name, u.email, u.balance, u.status, u.referralcode, u.lastcheckin,
                   u.hasmadefirstinvestment, u.createdat, r.email as referredbyemail, p.name as activeplanname
            FROM users u
            LEFT JOIN users r ON u.referredby = r.id
            LEFT JOIN investment_plans p ON u.activeplanid = p.id
            WHERE u.id = $1
        `;
        const userPromise = query(userSql, [numericUserId]);
        const transactionsPromise = query("SELECT * FROM transactions WHERE userId = $1 ORDER BY timestamp DESC", [numericUserId]);
        const referralsMadePromise = query("SELECT id, name, email, createdAt AS signupDate FROM users WHERE referredBy = $1 ORDER BY createdAt DESC", [numericUserId]);

        const [userResult, transactionsResult, referralsMadeResult] = await Promise.all([userPromise, transactionsPromise, referralsMadePromise]);

        const user = userResult.rows[0];
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({
            message: "User profile details fetched successfully.",
            data: {
                ...user,
                transactions: transactionsResult.rows || [],
                referralsMade: referralsMadeResult.rows || []
            }
        });
    } catch (error) {
        console.error("ADMIN_GET_USER_PROFILE_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve user profile details." });
    }
};

// Update a user's profile (name and status only)
exports.updateUserProfileByAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId);
        const { name, status } = req.body;

        if (req.body.balance !== undefined) {
            console.warn(`Admin (ID: ${req.admin.id}) attempted to update balance for user ${numericUserId} via profile edit. This is disallowed.`);
        }

        const sql = "UPDATE users SET name = $1, status = $2, updatedAt = CURRENT_TIMESTAMP WHERE id = $3";
        const result = await query(sql, [name, status, numericUserId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "User not found or no changes made." });
        }
        res.json({ message: `User ${numericUserId}'s profile updated successfully (name/status only).` });
    } catch (error) {
        console.error("ADMIN_UPDATE_USER_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to update user profile." });
    }
};

// Block a user
exports.blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await query("UPDATE users SET status = 'Blocked', updatedAt = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ message: `User ${userId} blocked successfully.` });
    } catch (error) {
        console.error("ADMIN_BLOCK_USER_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to block user." });
    }
};

// Unblock a user
exports.unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await query("UPDATE users SET status = 'Active', updatedAt = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ message: `User ${userId} unblocked successfully.` });
    } catch (error) {
        console.error("ADMIN_UNBLOCK_USER_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to unblock user." });
    }
};