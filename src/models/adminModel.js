// src/models/adminModel.js
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const findAdminByUsername = async (username) => {
    const sql = "SELECT * FROM admins WHERE username = $1";
    try {
        const { rows } = await query(sql, [username]);
        return rows[0];
    } catch (err) {
        console.error("DB_ERROR in findAdminByUsername:", err.message);
        throw err; // Propagate the error to be handled by the controller
    }
};

const createDefaultAdmin = async () => {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'Akash';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Akash@7274143$';

    try {
        const existingAdmin = await findAdminByUsername(username);
        if (existingAdmin) {
            return `Default admin '${username}' already exists.`;
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO admins (username, password, isDefault) VALUES ($1, $2, $3) RETURNING id`;
        const { rows } = await query(sql, [username, hashedPassword, true]);
        
        return `Default admin '${username}' created with ID ${rows[0].id}.`;
    } catch (error) {
        console.error("Error creating default admin:", error.message);
        throw error; // Propagate error
    }
};

module.exports = { findAdminByUsername, createDefaultAdmin };