// src/controllers/adminTransactionController.js
const { query, pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

// List pending deposits
exports.listPendingDeposits = async (req, res) => {
    try {
        const sql = `
            SELECT t.id, t.userid, u.email as useremail, t.amount, t.method, t.transactionidexternal, t.screenshoturl, t.timestamp as submittedat
            FROM transactions t
            JOIN users u ON t.userid = u.id
            WHERE t.type = 'Deposit' AND t.status = 'Pending'
            ORDER BY t.timestamp ASC
        `;
        const { rows } = await query(sql);
        res.json({ message: "Pending deposits fetched successfully.", data: rows });
    } catch (error) {
        console.error("ADMIN_LIST_DEPOSITS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve pending deposits." });
    }
};

// Approve a deposit request
exports.approveDeposit = async (req, res) => {
    const client = await pool.connect();
    try {
        const { transactionId } = req.params;
        const adminId = req.admin.id;

        await client.query('BEGIN');
        
        const { rows } = await client.query("SELECT * FROM transactions WHERE id = $1 AND type = 'Deposit' AND status = 'Pending' FOR UPDATE", [transactionId]);
        const transaction = rows[0];

        if (!transaction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Pending deposit not found or already processed." });
        }

        await client.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [transaction.amount, transaction.userid]);
        
        const newDescription = `Deposit approved by Admin ID ${adminId}. Original TID: ${transaction.transactionidexternal || 'N/A'}.`;
        await client.query("UPDATE transactions SET status = 'Approved', adminProcessedBy = $1, description = $2 WHERE id = $3", [adminId, newDescription, transactionId]);
        
        await client.query('COMMIT');
        
        res.json({ message: `Deposit ID ${transactionId} approved successfully.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("ADMIN_APPROVE_DEPOSIT_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to approve deposit." });
    } finally {
        client.release();
    }
};

// Reject a deposit request
exports.rejectDeposit = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const adminId = req.admin.id;

        const { rows } = await query("SELECT screenshoturl FROM transactions WHERE id = $1 AND type = 'Deposit' AND status = 'Pending'", [transactionId]);
        const transaction = rows[0];

        if (!transaction) {
            return res.status(404).json({ message: "Pending deposit not found or already processed." });
        }
        
        const newDescription = `Deposit rejected by Admin ID ${adminId}.`;
        const result = await query("UPDATE transactions SET status = 'Rejected', adminProcessedBy = $1, description = $2 WHERE id = $3", [adminId, newDescription, transactionId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Update failed, transaction may have been processed by another admin." });
        }

        if (transaction.screenshoturl) {
            const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');
            const filename = path.basename(transaction.screenshoturl);
            const screenshotPath = path.join(uploadsBaseDir, filename);

            fs.unlink(screenshotPath, (unlinkErr) => {
                if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                    console.warn(`Failed to delete screenshot ${screenshotPath}:`, unlinkErr.message);
                } else if (!unlinkErr) {
                    console.log(`Screenshot ${screenshotPath} deleted for rejected deposit.`);
                }
            });
        }
        
        res.json({ message: `Deposit ID ${transactionId} rejected successfully.` });
    } catch (error) {
        console.error("ADMIN_REJECT_DEPOSIT_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to reject deposit." });
    }
};

// List pending withdrawals
exports.listPendingWithdrawals = async (req, res) => {
    try {
        const sql = `
            SELECT t.id, t.userid, u.email as useremail, t.amount, t.method, t.accountnumber, t.timestamp as requestedat
            FROM transactions t
            JOIN users u ON t.userid = u.id
            WHERE t.type = 'Withdrawal' AND t.status = 'Pending'
            ORDER BY t.timestamp ASC
        `;
        const { rows } = await query(sql);
        res.json({ message: "Pending withdrawals fetched successfully.", data: rows });
    } catch (error) {
        console.error("ADMIN_LIST_WITHDRAWALS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve pending withdrawals." });
    }
};

// Approve a withdrawal request
exports.approveWithdrawal = async (req, res) => {
    const client = await pool.connect();
    try {
        const { transactionId } = req.params;
        const adminId = req.admin.id;

        await client.query('BEGIN');

        const { rows } = await client.query("SELECT * FROM transactions WHERE id = $1 AND type = 'Withdrawal' AND status = 'Pending' FOR UPDATE", [transactionId]);
        const transaction = rows[0];

        if (!transaction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Pending withdrawal not found or already processed." });
        }

        const userResult = await client.query("SELECT balance FROM users WHERE id = $1", [transaction.userid]);
        const user = userResult.rows[0];

        if (!user || user.balance < transaction.amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Cannot approve withdrawal. User has insufficient balance.` });
        }

        await client.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [transaction.amount, transaction.userid]);
        
        const newDescription = `Withdrawal to ${transaction.accountnumber} approved by Admin ID ${adminId}.`;
        await client.query("UPDATE transactions SET status = 'Approved', adminProcessedBy = $1, description = $2 WHERE id = $3", [adminId, newDescription, transactionId]);
        
        await client.query('COMMIT');
        
        res.json({ message: `Withdrawal ID ${transactionId} approved successfully.` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("ADMIN_APPROVE_WITHDRAWAL_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to approve withdrawal." });
    } finally {
        client.release();
    }
};

// Reject a withdrawal request
exports.rejectWithdrawal = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const adminId = req.admin.id;
        
        const newDescription = `Withdrawal rejected by Admin ID ${adminId}.`;
        const result = await query("UPDATE transactions SET status = 'Rejected', adminProcessedBy = $1, description = $2 WHERE id = $3 AND type = 'Withdrawal' AND status = 'Pending'", [adminId, newDescription, transactionId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Pending withdrawal not found or already processed." });
        }
        
        res.json({ message: `Withdrawal ID ${transactionId} rejected successfully.` });
    } catch (error) {
        console.error("ADMIN_REJECT_WITHDRAWAL_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to reject withdrawal." });
    }
};

// List all transactions for admin view
exports.listAllTransactions = async (req, res) => {
    try {
        const searchTerm = req.query.search || '';
        let sql = `
            SELECT t.*, u.email as useremail
            FROM transactions t JOIN users u ON t.userid = u.id
        `;
        const params = [];

        if (searchTerm) {
            sql += ` WHERE (u.email ILIKE $1 OR t.type ILIKE $1 OR t.status ILIKE $1 OR t.description ILIKE $1 OR t.method ILIKE $1 OR t.accountnumber ILIKE $1 OR t.transactionidexternal ILIKE $1)`;
            params.push(`%${searchTerm}%`);
        }
        sql += ` ORDER BY t.timestamp DESC`;

        const { rows } = await query(sql, params);
        res.json({ message: "All transactions fetched successfully.", data: rows });
    } catch (error) {
        console.error("ADMIN_LIST_ALL_TRANSACTIONS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve transaction history." });
    }
};