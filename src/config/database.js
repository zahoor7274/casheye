// src/config/database.js
const { Pool } = require('pg'); // Use the 'pg' library

// The Pool will automatically use the DATABASE_URL environment variable on Railway.
// For local testing, you might need to set up a local Postgres instance and create a .env file
// with a DATABASE_URL, but let's focus on deploying first.
console.log("DATABASE_LOG: Checking for DATABASE_URL environment variable...");
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_LOG_FATAL: DATABASE_URL environment variable is not set!");
    console.error("DATABASE_LOG_FATAL: Application cannot connect to the database. Exiting.");
    // Throwing an error will crash the app immediately and give a clear message.
    throw new Error("FATAL: Missing DATABASE_URL environment variable.");
}
console.log("DATABASE_LOG: DATABASE_URL is present.");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

console.log("DATABASE_LOG: PostgreSQL Pool configured.");

// Helper function to mimic the behavior of sqlite3's db.all, db.get, db.run
const db = {
    all: async (sql, params, callback) => {
        try {
            const result = await pool.query(sql, params);
            callback(null, result.rows);
        } catch (err) {
            callback(err, null);
        }
    },
    get: async (sql, params, callback) => {
        try {
            const result = await pool.query(sql, params);
            callback(null, result.rows[0]); // Return only the first row
        } catch (err) {
            callback(err, null);
        }
    },
    run: async (sql, params, callback) => {
        try {
            const result = await pool.query(sql, params);
            // Mimic the 'this' context for 'lastID' and 'changes'
            const context = {
                // NOTE: lastID is not standard in pg. Use 'RETURNING id' in SQL for this.
                // For simplicity, we'll return null here. Your code that relies on this may need changes.
                lastID: null, 
                changes: result.rowCount, // rowCount is the equivalent of 'changes'
            };
            callback.call(context, null);
        } catch (err) {
            callback.call({ lastID: null, changes: 0 }, err);
        }
    },
    // We will now handle transactions differently, so serialize is not needed in the same way.
    // However, your controllers might need to be updated to handle transactions with pg.
    // For now, let's assume individual queries. We will fix transactions if they break.
    serialize: (callback) => {
        // This is a placeholder. pg handles queries in parallel automatically.
        // For transactions, we need to get a client from the pool.
        console.warn("db.serialize() is a no-op with PostgreSQL. Transactions should be handled with a client from the pool.");
        callback();
    }
};

// Function to initialize tables with PostgreSQL-compatible syntax
const initTables = async () => {
    console.log("DATABASE_LOG: Initializing PostgreSQL tables...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // PostgreSQL uses SERIAL PRIMARY KEY instead of INTEGER PRIMARY KEY AUTOINCREMENT
        // It also has a proper BOOLEAN type.
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                balance REAL DEFAULT 0.00,
                referralCode TEXT UNIQUE,
                referredBy INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status TEXT DEFAULT 'Active',
                lastCheckIn TIMESTAMP,
                hasMadeFirstInvestment BOOLEAN DEFAULT FALSE,
                activePlanId INTEGER,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP
            );
        `);
        console.log("Users table checked/created.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                isDefault BOOLEAN DEFAULT FALSE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Admins table checked/created.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS investment_plans (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                investmentAmount REAL NOT NULL,
                dailyReturn REAL NOT NULL,
                durationDays INTEGER NOT NULL,
                description TEXT,
                isActive BOOLEAN DEFAULT TRUE,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP
            );
        `);
        console.log("Investment plans table checked/created.");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL,
                description TEXT,
                method TEXT,
                accountNumber TEXT,
                transactionIdExternal TEXT,
                screenshotUrl TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                adminProcessedBy INTEGER REFERENCES admins(id) ON DELETE SET NULL
            );
        `);
        console.log("Transactions table checked/created.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        console.log("Platform settings table checked/created.");
        
        // Add default settings if they don't exist
        await client.query(
            "INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
            ['deposit_accounts', JSON.stringify({
                easypaisa: { name: "EP Default Name", number: "03001234567", instructions: "Send to this EP account." },
                jazzcash: { name: "JC Default Name", number: "03017654321", instructions: "Send to this JC account." },
                binance_trc20_usdt: { name: "USDT (TRC20)", address: "", instructions: "", network: "TRC20" }
            })]
        );

        await client.query('COMMIT');
        console.log("DATABASE_LOG: Tables initialized and transaction committed.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("DATABASE_LOG_FATAL: Error during table initialization, transaction rolled back.", e);
        throw e; // Re-throw the error to be caught by the server startup
    } finally {
        client.release(); // IMPORTANT: release the client back to the pool
    }
};

module.exports = { db, initTables };