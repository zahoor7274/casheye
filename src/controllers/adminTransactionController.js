// src/controllers/transactionController.js

const { query, pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for Deposit Screenshots ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use the UPLOADS_DIR environment variable for production, fallback to a local path for development.
        const uploadPath = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads');
        
        console.log(`[MULTER DEBUG] Saving file to destination: ${uploadPath}`);

        // Ensure the directory exists.
        if (!fs.existsSync(uploadPath)) {
            console.log(`[MULTER DEBUG] Directory does not exist. Creating: ${uploadPath}`);
            try {
                fs.mkdirSync(uploadPath, { recursive: true });
            } catch (error) {
                console.error(`[MULTER DEBUG] FAILED to create directory: ${uploadPath}`, error);
                return cb(error, null);
            }
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Sanitize filename and make it unique
        const uniqueFilename = `${req.user.id}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        cb(null, uniqueFilename);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, or GIF are allowed.'), false);
    }
};

exports.uploadScreenshot = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
}).single('screenshot');


// --- User Invests in a Plan ---
exports.investInPlan = async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = req.user.id;
        const originalUser = req.user;
        const { planId } = req.body;
        const numericPlanId = parseInt(planId);

        const planResult = await client.query("SELECT * FROM investment_plans WHERE id = $1 AND isActive = TRUE", [numericPlanId]);
        const plan = planResult.rows[0];

        if (!plan) {
            return res.status(404).json({ message: "Investment plan not found or is inactive." });
        }

        if (originalUser.balance < plan.investmentamount) {
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
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error cleaning up orphaned upload file:", err);
            });
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
        const sql = `SELECT id, type, amount, status, description, method, accountNumber, transactionidexternal, screenshoturl, timestamp FROM transactions WHERE userId = $1 ORDER BY timestamp DESC`;
        const { rows } = await query(sql, [userId]);
        res.json({ message: "Transaction history fetched successfully.", data: rows });
    } catch (error) {
        console.error("GET_HISTORY_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve transaction history." });
    }
};