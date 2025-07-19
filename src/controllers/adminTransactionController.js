// src/controllers/adminTransactionController.js
const { query, pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

// --- Deposit Management ---

// List all pending deposit requests
/*exports.listPendingDeposits = (req, res) => {
    // Join with users table to get userEmail for display
    const sql = `
        SELECT t.id, t.userId, u.email as userEmail, t.amount, t.method, t.transactionIdExternal, t.screenshotUrl, t.timestamp as submittedAt
        FROM transactions t
        JOIN users u ON t.userId = u.id
        WHERE t.type = 'Deposit' AND t.status = 'Pending'
        ORDER BY t.timestamp ASC
    `; // Show oldest pending first

    db.all(sql, [], (err, deposits) => {
        if (err) {
            console.error("Error listing pending deposits:", err.message);
            return res.status(500).json({ message: "Failed to retrieve pending deposits." });
        }
        res.json({
            message: "Pending deposits fetched successfully.",
            data: deposits
        });
    });
};

// Approve a deposit request
// src/controllers/adminTransactionController.js
// Ensure 'db' is already required at the top of this file: const { db } = require('../config/database');

exports.approveDeposit = (req, res) => {
    const { transactionId } = req.params;
    const adminId = req.admin.id; // From protectAdmin middleware
    const numericTransactionId = parseInt(transactionId);

    if (isNaN(numericTransactionId)) {
        return res.status(400).json({ message: "Invalid Transaction ID." });
    }

    // First, get the transaction details to ensure it's a pending deposit
    db.get("SELECT * FROM transactions WHERE id = ? AND type = 'Deposit' AND status = 'Pending'", [numericTransactionId], (err, transaction) => {
        if (err) {
            console.error(`Error fetching deposit ${numericTransactionId} for approval:`, err.message);
            return res.status(500).json({ message: "Database error while fetching deposit details." });
        }
        if (!transaction) {
            return res.status(404).json({ message: "Pending deposit not found or already processed." });
        }

        const userId = transaction.userId;
        const depositAmount = transaction.amount;

        // Proceed with database transaction
        db.serialize(() => {
            db.run("BEGIN TRANSACTION;", (dbErr) => {
                if (dbErr) {
                    console.error("Begin transaction error for deposit approval:", dbErr.message);
                    return res.status(500).json({ message: "Database transaction error." });
                }

                // 1. Update user's balance
                db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [depositAmount, userId], function(updateErr) {
                    if (updateErr) {
                        db.run("ROLLBACK;");
                        console.error(`Error updating balance for user ${userId} on deposit approval:`, updateErr.message);
                        return res.status(500).json({ message: "Failed to approve deposit (user balance update error)." });
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK;");
                        console.warn(`User ${userId} not found for balance update during deposit approval.`);
                        return res.status(404).json({ message: "User not found for balance update." });
                    }

                    // 2. Update transaction status
                    const newDescription = `Deposit approved by Admin ID ${adminId}. Original TID: ${transaction.transactionIdExternal || 'N/A'}. User provided details: ${transaction.description || ''}`.trim();

                    db.run("UPDATE transactions SET status = ?, adminProcessedBy = ?, description = ? WHERE id = ?",
                        ['Approved', adminId, newDescription, numericTransactionId],
                        function(transUpdateErr) {
                        if (transUpdateErr) {
                            db.run("ROLLBACK;");
                            console.error(`Error updating deposit transaction ${numericTransactionId} status to Approved:`, transUpdateErr.message);
                            return res.status(500).json({ message: "Failed to approve deposit (transaction status update error)." });
                        }
                        if (this.changes === 0) {
                            db.run("ROLLBACK;");
                            console.error(`No transaction found with ID ${numericTransactionId} to update status to Approved, or status was not Pending.`);
                            return res.status(404).json({ message: "Transaction not found or status already processed, could not update status." });
                        }

                        // 3. Commit the transaction
                        db.run("COMMIT;", (commitErr) => {
                            if (commitErr) {
                                // Attempt to rollback if commit fails, though the DB might be in an indeterminate state
                                db.run("ROLLBACK;", (rollbackErr) => {
                                    if (rollbackErr) {
                                        console.error("Rollback attempt after commit failure also failed:", rollbackErr.message);
                                    }
                                });
                                console.error("Commit error during deposit approval:", commitErr.message);
                                return res.status(500).json({ message: "Failed to finalize deposit approval due to commit error." });
                            }
                            res.json({ message: `Deposit ID ${numericTransactionId} approved successfully.` });
                        });
                    }); // End of db.run for updating transaction status
                }); // End of db.run for updating user balance
            }); // End of db.run for BEGIN TRANSACTION
        }); // End of db.serialize
    }); // End of db.get for fetching transaction details
};

// Reject a deposit request
exports.rejectDeposit = (req, res) => {
    const { transactionId } = req.params;
    const adminId = req.admin.id;
    const numericTransactionId = parseInt(transactionId);
    // Optional: Get rejection reason from req.body if you add that to frontend
    // const { reason = "Rejected by admin" } = req.body;

    if (isNaN(numericTransactionId)) {
        return res.status(400).json({ message: "Invalid Transaction ID." });
    }

    db.get("SELECT screenshotUrl FROM transactions WHERE id = ? AND type = 'Deposit' AND status = 'Pending'", [numericTransactionId], (err, transaction) => {
        if (err) {
             console.error(`Error fetching deposit ${numericTransactionId} for rejection:`, err.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!transaction) {
            return res.status(404).json({ message: "Pending deposit not found or already processed." });
        }

        // Update transaction status to 'Rejected'
        db.run("UPDATE transactions SET status = 'Rejected', adminProcessedBy = ?, description = ? WHERE id = ?",
            [adminId, `Deposit rejected by Admin ID ${adminId}.`, numericTransactionId], function(updateErr) {
            if (updateErr) {
                console.error(`Error rejecting deposit ${numericTransactionId}:`, updateErr.message);
                return res.status(500).json({ message: "Failed to reject deposit." });
            }
            if (this.changes === 0) {
                return res.status(404).json({message: "Pending deposit not found or no changes made."});
            }

            // Optional: Delete the uploaded screenshot if the deposit is rejected
            if (transaction.screenshotUrl) {
                const screenshotPath = path.join(__dirname, '..', '..', 'public', transaction.screenshotUrl); // Construct absolute path
                fs.unlink(screenshotPath, (unlinkErr) => {
                    if (unlinkErr) {
                        console.warn(`Failed to delete screenshot ${screenshotPath} for rejected deposit ${numericTransactionId}:`, unlinkErr.message);
                    } else {
                        console.log(`Screenshot ${screenshotPath} deleted for rejected deposit ${numericTransactionId}.`);
                    }
                });
            }
            res.json({ message: `Deposit ID ${numericTransactionId} rejected successfully.` });
        });
    });
};

// List all pending withdrawal requests
exports.listPendingWithdrawals = (req, res) => {
    const sql = `
        SELECT t.id, t.userId, u.email as userEmail, t.amount, t.method, t.accountNumber, t.timestamp as requestedAt
        FROM transactions t
        JOIN users u ON t.userId = u.id
        WHERE t.type = 'Withdrawal' AND t.status = 'Pending'
        ORDER BY t.timestamp ASC
    `;

    db.all(sql, [], (err, withdrawals) => {
        if (err) {
            console.error("Error listing pending withdrawals:", err.message);
            return res.status(500).json({ message: "Failed to retrieve pending withdrawals." });
        }
        res.json({
            message: "Pending withdrawals fetched successfully.",
            data: withdrawals
        });
    });
};

// Approve a withdrawal request
exports.approveWithdrawal = (req, res) => {
    const { transactionId } = req.params;
    const adminId = req.admin.id;
    const numericTransactionId = parseInt(transactionId);

    if (isNaN(numericTransactionId)) {
        return res.status(400).json({ message: "Invalid Transaction ID." });
    }

    db.get("SELECT * FROM transactions WHERE id = ? AND type = 'Withdrawal' AND status = 'Pending'", [numericTransactionId], (err, transaction) => {
        if (err) {
            console.error(`Error fetching withdrawal ${numericTransactionId} for approval:`, err.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!transaction) {
            return res.status(404).json({ message: "Pending withdrawal not found or already processed." });
        }

        const userId = transaction.userId;
        const withdrawalAmount = transaction.amount;

        // Check if user has sufficient balance BEFORE approving
        db.get("SELECT balance FROM users WHERE id = ?", [userId], (userErr, user) => {
            if (userErr) {
                console.error(`Error fetching user ${userId} balance for withdrawal approval:`, userErr.message);
                return res.status(500).json({ message: "Database error checking user balance." });
            }
            if (!user) {
                 return res.status(404).json({ message: "User associated with withdrawal not found." });
            }
            if (user.balance < withdrawalAmount) {
                // Optionally, auto-reject here or let admin decide.
                // For now, we'll prevent approval if insufficient funds.
                return res.status(400).json({
                    message: `Cannot approve withdrawal. User ${userId} has insufficient balance (${user.balance.toFixed(2)} PKR) for withdrawal amount ${withdrawalAmount.toFixed(2)} PKR.`
                });
            }

            db.serialize(() => {
                db.run("BEGIN TRANSACTION;");

                // 1. Deduct user's balance
                db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [withdrawalAmount, userId], function(updateErr) {
                    if (updateErr) {
                        db.run("ROLLBACK;");
                        console.error(`Error updating balance for user ${userId} on withdrawal approval:`, updateErr.message);
                        return res.status(500).json({ message: "Failed to approve withdrawal (user balance update)." });
                    }
                     if (this.changes === 0) { // Should have been caught by user check above, but good defense
                        db.run("ROLLBACK;");
                        return res.status(404).json({ message: "User not found for balance update." });
                    }


                    // 2. Update transaction status
                    db.run("UPDATE transactions SET status = 'Approved', adminProcessedBy = ?, description = ? WHERE id = ?",
                        [adminId, `Withdrawal to ${transaction.accountNumber} approved by Admin ID ${adminId}.`, numericTransactionId], function(transUpdateErr) {
                        if (transUpdateErr) {
                            db.run("ROLLBACK;");
                            console.error(`Error updating withdrawal transaction ${numericTransactionId} status:`, transUpdateErr.message);
                            return res.status(500).json({ message: "Failed to approve withdrawal (transaction status update)." });
                        }

                        db.run("COMMIT;", (commitErr) => {
                            if (commitErr) {
                                db.run("ROLLBACK;");
                                console.error("Commit error during withdrawal approval:", commitErr.message);
                                return res.status(500).json({ message: "Failed to finalize withdrawal approval."});
                            }
                            res.json({ message: `Withdrawal ID ${numericTransactionId} approved successfully.` });
                        });
                    });
                });
            });
        });
    });
};

// Reject a withdrawal request
exports.rejectWithdrawal = (req, res) => {
    const { transactionId } = req.params;
    const adminId = req.admin.id;
    const numericTransactionId = parseInt(transactionId);
    // const { reason = "Rejected by admin" } = req.body;

    if (isNaN(numericTransactionId)) {
        return res.status(400).json({ message: "Invalid Transaction ID." });
    }

    // No balance change on rejection
    db.run("UPDATE transactions SET status = 'Rejected', adminProcessedBy = ?, description = ? WHERE id = ? AND type = 'Withdrawal' AND status = 'Pending'",
        [adminId, `Withdrawal rejected by Admin ID ${adminId}.`, numericTransactionId], function(err) {
        if (err) {
            console.error(`Error rejecting withdrawal ${numericTransactionId}:`, err.message);
            return res.status(500).json({ message: "Failed to reject withdrawal." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Pending withdrawal not found or already processed." });
        }
        res.json({ message: `Withdrawal ID ${numericTransactionId} rejected successfully.` });
    });
};


// --- All Transaction History (for Admin) ---
exports.listAllTransactions = (req, res) => {
    const searchTerm = req.query.search || '';
    let sql = `
        SELECT t.*, u.email as userEmail
        FROM transactions t
        JOIN users u ON t.userId = u.id
    `;
    const params = [];

    if (searchTerm) {
        sql += ` WHERE (u.email LIKE ? OR t.type LIKE ? OR t.status LIKE ? OR t.description LIKE ? OR t.method LIKE ? OR t.accountNumber LIKE ? OR t.transactionIdExternal LIKE ?)`;
        const searchPattern = `%${searchTerm}%`;
        for (let i = 0; i < 7; i++) params.push(searchPattern); // Add pattern for each searched field
    }
    sql += ` ORDER BY t.timestamp DESC`;

    db.all(sql, params, (err, transactions) => {
        if (err) {
            console.error("Error listing all transactions for admin:", err.message);
            return res.status(500).json({ message: "Failed to retrieve transaction history." });
        }
        res.json({
            message: "All transactions fetched successfully.",
            data: transactions
        });
    });
};*/
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
// src/controllers/adminTransactionController.js
// ...

exports.rejectDeposit = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const adminId = req.admin.id;

        const { rows } = await query("SELECT screenshoturl FROM transactions WHERE id = $1 AND type = 'Deposit' AND status = 'Pending'", [transactionId]);
        const transaction = rows[0];

        if (!transaction) {
            return res.status(404).json({ message: "Pending deposit not found or already processed." });
        }

        
        // ... (logic to update transaction status to 'Rejected')

        if (transaction.screenshoturl) {
            // Define the base uploads directory using the same logic as server.js
            const uploadsBaseDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');
            // Get just the filename from the URL path
            const filename = path.basename(transaction.screenshoturl);
            const screenshotPath = path.join(uploadsBaseDir, filename);

            console.log(`[REJECT DEBUG] Attempting to delete file at path: ${screenshotPath}`);

            fs.unlink(screenshotPath, (unlinkErr) => {
                if (unlinkErr) {
                    // This is okay if the file is already gone (ENOENT)
                    if (unlinkErr.code !== 'ENOENT') {
                        console.warn(`[REJECT DEBUG] Failed to delete screenshot ${screenshotPath}:`, unlinkErr.message);
                    } else {
                        console.log(`[REJECT DEBUG] Screenshot not found at ${screenshotPath}, which may be expected.`);
                    }
                } else {
                    console.log(`[REJECT DEBUG] Screenshot ${screenshotPath} deleted for rejected deposit.`);
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