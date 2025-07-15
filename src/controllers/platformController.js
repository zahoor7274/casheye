// src/controllers/platformController.js
const { query } = require('../config/database');

// Get active investment plans for users
exports.getInvestmentPlans = async (req, res) => {
    try {
        const sql = "SELECT id, name, investmentamount, dailyreturn, durationdays, description FROM investment_plans WHERE isActive = TRUE ORDER BY investmentamount ASC";
        const { rows } = await query(sql);
        res.json({ message: "Investment plans fetched successfully.", data: rows });
    } catch (error) {
        console.error("GET_PLANS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve investment plans." });
    }
};

// Get deposit account info for users
exports.getDepositInfo = async (req, res) => {
    try {
        const { rows } = await query("SELECT value FROM platform_settings WHERE key = $1", ['deposit_accounts']);
        if (rows[0] && rows[0].value) {
            const settings = JSON.parse(rows[0].value);
            res.json({ message: "Deposit information fetched successfully.", data: settings });
        } else {
            res.status(404).json({ message: "Deposit information not found." });
        }
    } catch (error) {
        console.error("GET_DEPOSIT_INFO_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve deposit information." });
    }
};