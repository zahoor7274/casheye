// src/controllers/platformController.js
const { db } = require('../config/database');

// Get all active investment plans
exports.getInvestmentPlans = (req, res) => {
    const sql = "SELECT id, name, investmentAmount, dailyReturn, durationDays, description FROM investment_plans WHERE isActive = TRUE ORDER BY investmentAmount ASC";
    db.all(sql, [], (err, plans) => {
        if (err) {
            console.error("Error fetching investment plans:", err.message);
            return res.status(500).json({ message: "Could not retrieve investment plans." });
        }
        res.json({
            message: "Investment plans fetched successfully.",
            data: plans
        });
    });
};

// Get platform deposit information
exports.getDepositInfo = (req, res) => {
    // We'll implement this later
    db.get("SELECT value FROM platform_settings WHERE key = ?", ['deposit_accounts'], (err, row) => {
        if (err) {
            console.error("Error fetching deposit info:", err.message);
            return res.status(500).json({ message: "Could not retrieve deposit information." });
        }
        if (row && row.value) {
            try {
                const depositInfo = JSON.parse(row.value);
                res.json({
                    message: "Deposit information fetched successfully.",
                    data: depositInfo
                });
            } catch (parseError) {
                console.error("Error parsing deposit info:", parseError.message);
                res.status(500).json({ message: "Error processing deposit information." });
            }
        } else {
            res.status(404).json({ message: "Deposit information not found." });
        }
    });
};