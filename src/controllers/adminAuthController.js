// src/controllers/adminAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { findAdminByUsername } = require('../models/adminModel'); // We already created this

exports.adminLogin = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const admin = await findAdminByUsername(username);

        if (!admin) {
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid admin credentials.' });
        }

        const payload = { adminId: admin.id, username: admin.username, role: 'admin' }; // Add role
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); // Admin token expires in 1 day

        res.json({
            message: 'Admin logged in successfully.',
            token,
            admin: {
                id: admin.id,
                username: admin.username
            }
        });

    } catch (error) {
        console.error("Admin login error:", error.message);
        res.status(500).json({ message: 'Server error during admin login.' });
    }
};