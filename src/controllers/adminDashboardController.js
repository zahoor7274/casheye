// src/controllers/adminDashboardController.js
const { db } = require('../config/database');

exports.getDashboardStats = async (req, res) => {
    // req.admin is attached by the protectAdmin middleware
    if (!req.admin) {
       return res.status(403).json({ message: "Access forbidden." }); // Should be caught by middleware, but good check
    }

    try {
        const totalUsersPromise = new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        const pendingDepositsPromise = new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM transactions WHERE type = 'Deposit' AND status = 'Pending'", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        const pendingWithdrawalsPromise = new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM transactions WHERE type = 'Withdrawal' AND status = 'Pending'", (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.count : 0);
            });
        });

        // For total platform balance, this is a simplified view.
        // A real system might have more complex accounting (e.g., sum of all user balances).
        // Or it might be a manually maintained value, or calculated differently.
        // For now, let's sum user balances as a proxy.
        const totalPlatformBalancePromise = new Promise((resolve, reject) => {
            db.get("SELECT SUM(balance) as totalBalance FROM users", (err, row) => {
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
};