// src/controllers/adminAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { findAdminByUsername } = require('../models/adminModel'); // We already created this

exports.adminLogin = async (req, res) => {
    console.log("--- ADMIN LOGIN ATTEMPT START ---");

    const { username, password } = req.body;
    console.log(`[1] Received login attempt for username: '${username}'`);

    if (!username || !password) {
        console.log("[FAIL] Missing username or password in the request body.");
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        console.log(`[2] Calling findAdminByUsername('${username}')...`);
        // We also need to see the code for findAdminByUsername
        const admin = await findAdminByUsername(username);

        // This is the MOST IMPORTANT log.
        console.log("[3] Result from database for findAdminByUsername:", admin);

        if (!admin) {
            console.log("[FAIL] No admin found in the database with that username.");
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }

        console.log(`[4] Admin found. Comparing passwords.`);
        console.log(`    -> Plain text password received: '${password}'`);
        console.log(`    -> Hashed password from DB: '${admin.password}'`);

        const isMatch = await bcrypt.compare(password, admin.password);
        
        // This is the SECOND MOST IMPORTANT log.
        console.log(`[5] bcrypt.compare result (isMatch): ${isMatch}`);

        if (!isMatch) {
            console.log("[FAIL] Passwords do not match.");
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }

        console.log("[6] Password match! Checking for JWT secret...");
        if (!process.env.JWT_SECRET) {
            console.error("[FATAL] JWT_SECRET environment variable is NOT SET!");
            return res.status(500).json({ message: 'Server configuration error.' });
        }
        console.log("[7] JWT_SECRET is present. Generating token...");

        const payload = { adminId: admin.id, username: admin.username, role: 'admin' };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        console.log("[8] SUCCESS! Token generated. Sending response.");
        console.log("--- ADMIN LOGIN ATTEMPT END ---");

        res.json({
            message: 'Admin logged in successfully.',
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });

    } catch (error) {
        console.error("[FATAL] An unexpected error occurred in the adminLogin try/catch block.", error);
        res.status(500).json({ message: 'Server error during admin login.' });
    }
};