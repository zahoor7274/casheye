// create-live-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// --- CONFIGURE YOUR NEW ADMIN CREDENTIALS HERE ---
const NEW_ADMIN_USERNAME = 'ZaHooR_aHmAd'; // e.g., 'superadmin'
const NEW_ADMIN_PASSWORD = 'ZaHooR@7274143$'; // Choose a strong password
// ---------------------------------------------------

if (!NEW_ADMIN_USERNAME || !NEW_ADMIN_PASSWORD || NEW_ADMIN_PASSWORD.length < 8) {
    console.error("Please set a valid username and a strong password (at least 8 characters) in the script.");
    process.exit(1);
}

// This path points to the database file within the deployed environment's filesystem
const dbPath = process.env.DATABASE_PATH || './casheye.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error('Error opening database:', err.message);
    }
    console.log('Successfully connected to the SQLite database.');
});

const createAdmin = async () => {
    try {
        console.log(`Checking if admin '${NEW_ADMIN_USERNAME}' already exists...`);
        const existingAdmin = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM admins WHERE username = ?", [NEW_ADMIN_USERNAME], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingAdmin) {
            console.log(`Admin '${NEW_ADMIN_USERNAME}' already exists. No action taken.`);
            db.close();
            return;
        }

        console.log("Admin does not exist. Creating new admin...");
        const hashedPassword = await bcrypt.hash(NEW_ADMIN_PASSWORD, 10);
        const sql = `INSERT INTO admins (username, password, isDefault) VALUES (?, ?, ?)`;

        db.run(sql, [NEW_ADMIN_USERNAME, hashedPassword, false], function (err) {
            if (err) {
                console.error('Error inserting new admin:', err.message);
            } else {
                console.log(`✅ Successfully created admin '${NEW_ADMIN_USERNAME}' with ID: ${this.lastID}`);
            }
            db.close();
        });
    } catch (error) {
        console.error('An unexpected error occurred:', error);
        db.close();
    }
};

createAdmin();