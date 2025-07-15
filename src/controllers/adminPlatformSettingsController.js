// src/controllers/adminPlatformSettingsController.js
const { query } = require('../config/database');

// Get current deposit account settings
/*exports.getDepositAccountSettings = (req, res) => {
    db.get("SELECT value FROM platform_settings WHERE key = ?", ['deposit_accounts'], (err, row) => {
        if (err) {
            console.error("Error fetching deposit account settings:", err.message);
            return res.status(500).json({ message: "Failed to retrieve deposit account settings." });
        }
        if (row && row.value) {
            try {
                const settings = JSON.parse(row.value);
                res.json({
                    message: "Deposit account settings fetched successfully.",
                    data: settings
                });
            } catch (parseError) {
                console.error("Error parsing deposit account settings from DB:", parseError.message);
                res.status(500).json({ message: "Error processing settings data." });
            }
        } else {
            // If no settings found, return empty/default structure expected by frontend
            res.json({
                message: "Deposit account settings not found, returning default structure.",
                data: {
                    easypaisa: { name: "", number: "", instructions: "" },
                    jazzcash: { name: "", number: "", instructions: "" }
                    //binance_trc20_usdt: { name: "USDT (TRC20)", address: "", instructions: "", network: "TRC20" }
                }
            });
        }
    });
};

// Update deposit account settings
exports.updateDepositAccountSettings = (req, res) => {
    const { easypaisa, jazzcash,  } = req.body;

    // Basic validation (can be more extensive)
    if (!easypaisa || !jazzcash || 
        typeof easypaisa.name !== 'string' || typeof easypaisa.number !== 'string' || typeof easypaisa.instructions !== 'string' ||
        typeof jazzcash.name !== 'string' || typeof jazzcash.number !== 'string' || typeof jazzcash.instructions !== 'string')

        {
        return res.status(400).json({ message: "Invalid settings format. Ensure easypaisa and jazzcash objects with their respective fields are provided." });
    }

    const newSettings = {
        easypaisa: {
            name: (easypaisa.name || "Easypaisa").trim(),
            number: (easypaisa.number || "").trim(),
            instructions: (easypaisa.instructions || "").trim()
        },
        jazzcash: {
            name: (jazzcash.name || "JazzCash").trim(),
            number: (jazzcash.number || "").trim(),
            instructions: (jazzcash.instructions || "").trim()
        }
    };

    const settingsJson = JSON.stringify(newSettings);

    // Use INSERT OR REPLACE (UPSERT) to update if exists, or insert if not
    db.run("INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)",
        ['deposit_accounts', settingsJson], function(err) {
        if (err) {
            console.error("Error updating deposit account settings:", err.message);
            return res.status(500).json({ message: "Failed to save deposit account settings." });
        }
        res.json({
            message: "Deposit account settings updated successfully.",
            data: newSettings
        });
    });
};

// Get all investment plans (for admin display, read-only from this endpoint)
// Get all investment plans (for admin display, includes isActive)
exports.getAdminInvestmentPlans = (req, res) => {
    const sql = "SELECT id, name, investmentAmount, dailyReturn, durationDays, description, isActive FROM investment_plans ORDER BY investmentAmount ASC, id ASC";
    db.all(sql, [], (err, plans) => {
        if (err) {
            console.error("Error fetching investment plans for admin:", err.message);
            return res.status(500).json({ message: "Could not retrieve investment plans." });
        }
        res.json({
            message: "Investment plans fetched successfully for admin view.",
            data: plans
        });
    });
};

// Create a new investment plan
exports.createInvestmentPlan = (req, res) => {
    const { name, investmentAmount, dailyReturn, durationDays, description, isActive = true } = req.body;

    // Validation
    if (!name || !investmentAmount || !dailyReturn || !durationDays) {
        return res.status(400).json({ message: "Name, investment amount, daily return, and duration are required." });
    }
    if (isNaN(parseFloat(investmentAmount)) || parseFloat(investmentAmount) <= 0 ||
        isNaN(parseFloat(dailyReturn)) || parseFloat(dailyReturn) < 0 || // Daily return can be 0, but not negative
        isNaN(parseInt(durationDays)) || parseInt(durationDays) <= 0) {
        return res.status(400).json({ message: "Investment amount, daily return, and duration must be valid positive numbers." });
    }

    const sql = `INSERT INTO investment_plans (name, investmentAmount, dailyReturn, durationDays, description, isActive)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
    db.run(sql, [
        name,
        parseFloat(investmentAmount),
        parseFloat(dailyReturn),
        parseInt(durationDays),
        description || null, // Allow null description
        isActive === true || isActive === 'true' || isActive === 1 // Ensure boolean
    ], function(err) {
        if (err) {
            console.error("Error creating investment plan:", err.message);
            if (err.message.includes("UNIQUE constraint failed")) { // More specific error
                return res.status(409).json({ message: "An investment plan with this name might already exist or another unique constraint failed."})
            }
            return res.status(500).json({ message: "Failed to create investment plan." });
        }
        res.status(201).json({
            message: "Investment plan created successfully.",
            data: { id: this.lastID, name, investmentAmount, dailyReturn, durationDays, description, isActive }
        });
    });
};

// Update an existing investment plan
exports.updateInvestmentPlan = (req, res) => {
    const { planId } = req.params;
    const numericPlanId = parseInt(planId);
    const { name, investmentAmount, dailyReturn, durationDays, description, isActive } = req.body;

    if (isNaN(numericPlanId)) {
        return res.status(400).json({ message: "Invalid Plan ID." });
    }

    // Validation (similar to create, but all fields are optional for update)
    // Construct dynamic query parts
    const fieldsToUpdate = [];
    const values = [];

    if (name !== undefined) {
        fieldsToUpdate.push("name = ?");
        values.push(name);
    }
    if (investmentAmount !== undefined) {
        if (isNaN(parseFloat(investmentAmount)) || parseFloat(investmentAmount) <= 0) return res.status(400).json({message: "Invalid investment amount."});
        fieldsToUpdate.push("investmentAmount = ?");
        values.push(parseFloat(investmentAmount));
    }
    if (dailyReturn !== undefined) {
        if (isNaN(parseFloat(dailyReturn)) || parseFloat(dailyReturn) < 0) return res.status(400).json({message: "Invalid daily return."});
        fieldsToUpdate.push("dailyReturn = ?");
        values.push(parseFloat(dailyReturn));
    }
    if (durationDays !== undefined) {
        if (isNaN(parseInt(durationDays)) || parseInt(durationDays) <= 0) return res.status(400).json({message: "Invalid duration days."});
        fieldsToUpdate.push("durationDays = ?");
        values.push(parseInt(durationDays));
    }
    if (description !== undefined) {
        fieldsToUpdate.push("description = ?");
        values.push(description === null || description.trim() === '' ? null : description);
    }
    if (isActive !== undefined) {
        fieldsToUpdate.push("isActive = ?");
        values.push(isActive === true || isActive === 'true' || isActive === 1 ? 1 : 0); // Ensure boolean
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ message: "No fields provided for update." });
    }

    fieldsToUpdate.push("updatedAt = CURRENT_TIMESTAMP"); // Always update timestamp if other fields are updated

    const sql = `UPDATE investment_plans SET ${fieldsToUpdate.join(", ")} WHERE id = $1`;
    values.push(numericPlanId);

    db.run(sql, values, function(err) {
        if (err) {
            console.error(`Error updating investment plan ${numericPlanId}:`, err.message);
             if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(409).json({ message: "Update failed due to a unique constraint (e.g., plan name already exists)."});
            }
            return res.status(500).json({ message: "Failed to update investment plan." });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Investment plan not found or no changes made." });
        }
        res.json({ message: `Investment plan ${numericPlanId} updated successfully.` });
    });
};
*/
// Get deposit account settings
exports.getDepositAccountSettings = async (req, res) => {
    try {
        const { rows } = await query("SELECT value FROM platform_settings WHERE key = $1", ['deposit_accounts']);
        if (rows[0] && rows[0].value) {
            const settings = JSON.parse(rows[0].value);
            res.json({ message: "Deposit account settings fetched successfully.", data: settings });
        } else {
            res.json({
                message: "Deposit settings not found, returning default.",
                data: {
                    easypaisa: { name: "", number: "", instructions: "" },
                    jazzcash: { name: "", number: "", instructions: "" },
                    binance_trc20_usdt: { name: "USDT (TRC20)", address: "", instructions: "", network: "TRC20" }
                }
            });
        }
    } catch (error) {
        console.error("ADMIN_GET_DEPOSIT_SETTINGS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to retrieve deposit account settings." });
    }
};

// Update deposit account settings
exports.updateDepositAccountSettings = async (req, res) => {
    try {
        const settingsJson = JSON.stringify(req.body); // Assumes validation happened in middleware
        const sql = "INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2";
        await query(sql, ['deposit_accounts', settingsJson]);
        res.json({ message: "Deposit account settings updated successfully.", data: req.body });
    } catch (error) {
        console.error("ADMIN_UPDATE_DEPOSIT_SETTINGS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Failed to save deposit account settings." });
    }
};

// --- Investment Plan Management ---

// List all investment plans for admin
exports.getAdminInvestmentPlans = async (req, res) => {
    try {
        const sql = "SELECT id, name, investmentamount, dailyreturn, durationdays, description, isactive FROM investment_plans ORDER BY investmentamount ASC, id ASC";
        const { rows } = await query(sql);
        res.json({ message: "Investment plans fetched successfully.", data: rows });
    } catch (error) {
        console.error("ADMIN_LIST_PLANS_ERROR:", error.message, error.stack);
        res.status(500).json({ message: "Could not retrieve investment plans." });
    }
};

// Create a new investment plan
exports.createInvestmentPlan = async (req, res) => {
    try {
        const { name, investmentAmount, dailyReturn, durationDays, description, isActive = true } = req.body;
        const sql = `INSERT INTO investment_plans (name, investmentAmount, dailyReturn, durationDays, description, isActive) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
        const params = [name, investmentAmount, dailyReturn, durationDays, description, isActive];
        const { rows } = await query(sql, params);
        res.status(201).json({ message: "Investment plan created successfully.", data: { id: rows[0].id, ...req.body } });
    } catch (error) {
        console.error("ADMIN_CREATE_PLAN_ERROR:", error.message, error.stack);
        if (error.code === '23505') { // PostgreSQL unique violation code
            return res.status(409).json({ message: "An investment plan with this name already exists." });
        }
        res.status(500).json({ message: "Failed to create investment plan." });
    }
};

// Update an existing investment plan
exports.updateInvestmentPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const fieldsToUpdate = [];
        const values = [];
        let paramIndex = 1;

        for (const key in req.body) {
            if (Object.hasOwnProperty.call(req.body, key)) {
                // Convert camelCase from JS to snake_case for DB if necessary, or just use camelCase in DB
                // Assuming your DB columns are now lowercase, e.g., investmentamount
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                fieldsToUpdate.push(`${dbKey.toLowerCase()} = $${paramIndex++}`);
                values.push(req.body[key]);
            }
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ message: "No fields provided for update." });
        }
        
        fieldsToUpdate.push(`updatedAt = CURRENT_TIMESTAMP`);

        const sql = `UPDATE investment_plans SET ${fieldsToUpdate.join(", ")} WHERE id = $${paramIndex}`;
        values.push(planId);

        const result = await query(sql, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Investment plan not found or no changes made." });
        }
        res.json({ message: `Investment plan ${planId} updated successfully.` });
    } catch (error) {
        console.error("ADMIN_UPDATE_PLAN_ERROR:", error.message, error.stack);
        if (error.code === '23505') {
            return res.status(409).json({ message: "Update failed, plan name may already be in use." });
        }
        res.status(500).json({ message: "Failed to update investment plan." });
    }
};