// src/controllers/adminDashboardController.js
const { query } = require('../config/database')
//const { db } = require('../config/database');

/*exports.getDashboardStats = async (req, res) => {
    // req.admin is attached by the protectAdmin middleware
    if (!req.admin) {
       return res.status(403).json({ message: "Access forbidden." }); // Should be caught by middleware, but good check
    }

    try {
        const totalUsersPromise = new Promise((resolve, reject) => {
            await query("SELECT COUNT(*) as count FROM users", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        const pendingDepositsPromise = new Promise((resolve, reject) => {
            await query("SELECT COUNT(*) as count FROM transactions WHERE type = 'Deposit' AND status = 'Pending'", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        const pendingWithdrawalsPromise = new Promise((resolve, reject) => {
            await query("SELECT COUNT(*) as count FROM transactions WHERE type = 'Withdrawal' AND status = 'Pending'", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        // For total platform balance, this is a simplified view.
        // A real system might have more complex accounting (e.g., sum of all user balances).
        // Or it might be a manually maintained value, or calculated differently.
        // For now, let's sum user balances as a proxy.
        const totalPlatformBalancePromise = new Promise((resolve, reject) => {
            await query("SELECT SUM(balance) as totalBalance FROM users", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.totalBalance : 0);
            });
        });

        const [totalUsers, pendingDeposits, pendingWithdrawals, totalPlatformBalance] = await Promise.all([
            totalUsersPromise,
            pendingDepositsPromise,
            pendingWithdrawalsPromise,
            totalPlatformBalancePromise
        ]);

        res.json({
            message: `Admin dashboard stats fetched successfully.`,
            data: {
                totalUsers: totalUsers || 0,
                pendingDeposits: pendingDeposits || 0,
                pendingWithdrawals: pendingWithdrawals || 0,
                totalPlatformBalance: parseFloat(totalPlatformBalance || 0).toFixed(2)
            }
        });

    } catch (error) {
        console.error("Error fetching admin dashboard stats:", error.message);
        res.status(500).json({ message: "Failed to retrieve dashboard statistics." });
    }
};*/
// src/controllers/adminDashboardController.js
exports.getDashboardStats = async (req, res) => {
    try {
        const totalUsersPromise = query("SELECT COUNT(*) as count FROM users");
        const pendingDepositsPromise = query("SELECT COUNT(*) as count FROM transactions WHERE type = 'Deposit' AND status = 'Pending'");
        const pendingWithdrawalsPromise = query("SELECT COUNT(*) as count FROM transactions WHERE type = 'Withdrawal' AND status = 'Pending'");
        const totalPlatformBalancePromise = query("SELECT SUM(balance) as totalBalance FROM users");

        const [
            totalUsersResult,
            pendingDepositsResult,
            pendingWithdrawalsResult,
            totalPlatformBalanceResult
        ] = await Promise.all([
            totalUsersPromise,
            pendingDepositsPromise,
            pendingWithdrawalsPromise,
            totalPlatformBalancePromise
        ]);

        const stats = {
            totalUsers: parseInt(totalUsersResult.rows[0].count) || 0,
            pendingDeposits: parseInt(pendingDepositsResult.rows[0].count) || 0,
            pendingWithdrawals: parseInt(pendingWithdrawalsResult.rows[0].count) || 0,
            totalPlatformBalance: parseFloat(totalPlatformBalanceResult.rows[0].totalbalance || 0).toFixed(2)
        };

        res.json({
            message: `Admin dashboard stats fetched successfully.`,
            data: stats
        });

    } catch (error) {
        console.error("ADMIN_DASHBOARD_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve dashboard statistics." });
    }
};