// src/models/adminModel.js
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

// src/models/adminModel.js
// ...
const createDefaultAdmin = () => { // Remove parameters
    const username = process.env.DEFAULT_ADMIN_USERNAME
    const password = process.env.DEFAULT_ADMIN_PASSWORD

    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM admins WHERE username = ?", [username], async (err, row) => {
            if (err) return reject("Database error checking admin: " + err.message);
            if (row) return resolve(`Default admin '${username}' already exists.`);

            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                db.run(
                    "INSERT INTO admins (username, password, isDefault) VALUES (?, ?, ?)",
                    [username, hashedPassword, true],
                    function (err) {
                        if (err) return reject("Error creating default admin: " + err.message);
                        resolve(`Default admin '${username}' created with ID ${this.lastID}.`);
                    }
                );
            } catch (hashError) {
                reject("Error hashing admin password: " + hashError.message);
            }
        });
    });
}; 
const findAdminByUsername = (username) => {
    return new Promise((resolve, reject) => {
        // The query is case-sensitive by default in SQLite unless you use COLLATE NOCASE.
        // Let's assume username is stored and checked with exact case for now.
        db.get("SELECT * FROM admins WHERE username = ?", [username], (err, row) => {
            if (err) {
                console.error("DB_ERROR in findAdminByUsername:", err);
                return reject(err);
            }
            resolve(row); // 'row' will be the admin object or `undefined` if not found
        });
    });
};


module.exports = { createDefaultAdmin, findAdminByUsername };