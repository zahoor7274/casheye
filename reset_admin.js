// reset_admin.js
const { Pool } = require('pg'); // We will use 'pg' directly
const bcrypt = require('bcryptjs');

// --- PASTE THE PUBLIC CONNECTION URL FROM RAILWAY HERE ---
// Get this from your PostgreSQL service -> "Variables" tab -> DATABASE_PUBLIC_URL
const PUBLIC_DATABASE_URL = 'postgresql://postgres:cOcnOeSmNcTPsothZmQnCviKmagZxbJK@yamabiko.proxy.rlwy.net:23857/railway';
// ---------------------------------------------------------

// --- CREDENTIALS TO RESET TO ---
const RESET_USERNAME = 'Akash';
const RESET_PASSWORD = 'Akash@7274143$';
// -----------------------------


// --- SCRIPT LOGIC ---
if (!PUBLIC_DATABASE_URL || !PUBLIC_DATABASE_URL.startsWith('postgres')) {
    console.error("ERROR: Please paste the full public PostgreSQL connection URL from Railway into the PUBLIC_DATABASE_URL constant in this script.");
    process.exit(1);
}

// Create a new Pool instance specifically for this script using the public URL
const pool = new Pool({
    connectionString: PUBLIC_DATABASE_URL,
    ssl: { rejectUnauthorized: false } // SSL is required for external connections to Railway DBs
});

const resetAdminAccount = async () => {
    let client;
    try {
        console.log("Connecting to PostgreSQL via PUBLIC URL...");
        client = await pool.connect(); // Get a client from the pool
        console.log("Successfully connected.");

        console.log("\nStep 1: Deleting all existing admin accounts...");
        const deleteResult = await client.query("DELETE FROM admins");
        console.log(`Successfully deleted ${deleteResult.rowCount} admin account(s).`);

        console.log("\nStep 2: Creating new default admin account...");
        console.log(`   -> Username: ${RESET_USERNAME}`);
        console.log(`   -> Password: ${RESET_PASSWORD}`);
        
        const hashedPassword = await bcrypt.hash(RESET_PASSWORD, 10);
        const sql = `INSERT INTO admins (username, password, isDefault) VALUES ($1, $2, $3) RETURNING id`;
        const insertResult = await client.query(sql, [RESET_USERNAME, hashedPassword, true]);
        
        console.log(`\n✅ SUCCESS: Admin account reset successfully.`);
        console.log(`   New admin created with ID: ${insertResult.rows[0].id}`);

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        if (client) {
            client.release(); // Release the client back to the pool
        }
        await pool.end(); // Close all connections in the pool
        console.log("\nDatabase connection pool closed. Process finished.");
    }
};

resetAdminAccount();