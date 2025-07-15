// src/config/database.js

const { Pool } = require('pg');

console.log("DATABASE_LOG: Checking for DATABASE_URL environment variable...");
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_LOG_FATAL: DATABASE_URL environment variable is not set!");
    throw new Error("FATAL: Missing DATABASE_URL environment variable.");
}
console.log("DATABASE_LOG: DATABASE_URL is present.");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

console.log("DATABASE_LOG: PostgreSQL Pool configured.");

// Export a query function that uses the pool, and the pool itself for transactions
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool: pool,
    initTables: async () => {
        console.log("DATABASE_LOG: Initializing PostgreSQL tables...");
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Users Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL, balance REAL DEFAULT 0.00, referralCode TEXT UNIQUE,
                    referredBy INTEGER REFERENCES users(id) ON DELETE SET NULL, status TEXT DEFAULT 'Active',
                    lastCheckIn TIMESTAMP, hasMadeFirstInvestment BOOLEAN DEFAULT FALSE,
                    activePlanId INTEGER, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP
                );
            `);
            console.log("Users table checked/created.");
            // Admins Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS admins (
                    id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
                    isDefault BOOLEAN DEFAULT FALSE, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("Admins table checked/created.");
            // Investment Plans Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS investment_plans (
                    id SERIAL PRIMARY KEY, name TEXT NOT NULL, investmentAmount REAL NOT NULL,
                    dailyReturn REAL NOT NULL, durationDays INTEGER NOT NULL, description TEXT,
                    isActive BOOLEAN DEFAULT TRUE, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP
                );
            `);
            console.log("Investment plans table checked/created.");
            // Transactions Table
            await client.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id SERIAL PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    type TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, description TEXT,
                    method TEXT, accountNumber TEXT, transactionIdExternal TEXT, screenshotUrl TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, adminProcessedBy INTEGER REFERENCES admins(id) ON DELETE SET NULL
                );
            `);
            console.log("Transactions table checked/created.");
            // Platform Settings Table
            await client.query(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT);`);
            console.log("Platform settings table checked/created.");
            // Insert default settings
            await client.query(
                "INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
                ['deposit_accounts', JSON.stringify({
                    easypaisa: { name: "EP Default Name", number: "03001234567", instructions: "Send to this EP account." },
                    jazzcash: { name: "JC Default Name", number: "03017654321", instructions: "Send to this JC account." },
                    binance_trc20_usdt: { name: "USDT (TRC20)", address: "", instructions: "", network: "TRC20" }
                })]
            );
            await client.query('COMMIT');
            console.log("DATABASE_LOG: Tables initialized successfully.");
        } catch (e) {
            await client.query('ROLLBACK');
            console.error("DATABASE_LOG_FATAL: Error during table initialization, transaction rolled back.", e);
            throw e;
        } finally {
            client.release();
        }
    }
};