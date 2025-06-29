// reset_admin.js
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// --- CREDENTIALS TO RESET TO ---
const RESET_USERNAME = 'KaSo@gmail.com';
const RESET_PASSWORD = 'KaSo@7274143$';
// -----------------------------

const dbPath = process.env.DATABASE_PATH || './casheye.sqlite'; // Assumes the script is run from the project root
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error('Error opening database:', err.message);
    }
    console.log('Successfully connected to the SQLite database.');
});

const resetAdminAccount = async () => {
    try {
        console.log("Step 1: Deleting all existing admin accounts...");
        await new Promise((resolve, reject) => {
            db.run("DELETE FROM admins", function (err) {
                if (err) {
                    console.error('Error deleting admins:', err.message);
                    reject(err);
                } else {
                    console.log(`Successfully deleted ${this.changes} admin account(s).`);
                    resolve();
                }
            });
        });

        console.log("\nStep 2: Creating new default admin account...");
        console.log(`   -> Username: ${RESET_USERNAME}`);
        console.log(`   -> Password: ${RESET_PASSWORD}`);
        
        const hashedPassword = await bcrypt.hash(RESET_PASSWORD, 10);
        const sql = `INSERT INTO admins (username, password, isDefault) VALUES (?, ?, ?)`;

        await new Promise((resolve, reject) => {
            db.run(sql, [RESET_USERNAME, hashedPassword, true], function (err) {
                if (err) {
                    console.error('Error inserting new admin:', err.message);
                    reject(err);
                } else {
                    console.log(`\n✅ SUCCESS: Admin account reset successfully.`);
                    console.log(`   New admin created with ID: ${this.lastID}`);
                    resolve();
                }
            });
        });

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        db.close((err) => {
            if (err) console.error('Error closing database:', err.message);
            else console.log("\nDatabase connection closed.");
        });
    }
};

resetAdminAccount();