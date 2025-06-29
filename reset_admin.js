// reset_admin.js
const { db } = require('./src/config/database'); // Import our new db wrapper
const bcrypt = require('bcryptjs');

const RESET_USERNAME = 'KaSo@gmail.com';
const RESET_PASSWORD = 'KaSo@7274143$';

const resetAdminAccount = async () => {
    try {
        console.log("Connecting to PostgreSQL...");
        // db functions are now async and use callbacks, perfect for this script
        
        console.log("Step 1: Deleting all existing admin accounts...");
        await new Promise((resolve, reject) => {
            db.run("DELETE FROM admins", [], function(err) {
                if (err) return reject(err);
                console.log(`Successfully deleted ${this.changes} admin account(s).`);
                resolve();
            });
        });

        console.log("\nStep 2: Creating new default admin account...");
        const hashedPassword = await bcrypt.hash(RESET_PASSWORD, 10);
        const sql = `INSERT INTO admins (username, password, isDefault) VALUES ($1, $2, $3)`;

        await new Promise((resolve, reject) => {
            db.run(sql, [RESET_USERNAME, hashedPassword, true], function(err) {
                if (err) return reject(err);
                console.log(`\n✅ SUCCESS: Admin account reset successfully.`);
                resolve();
            });
        });
        
        console.log("NOTE: 'lastID' is not supported with this pg setup. Admin was created.");

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        console.log("\nProcess finished. The connection pool will handle closing.");
        // With a connection pool, you don't manually close it in a short-lived script.
    }
};

resetAdminAccount();