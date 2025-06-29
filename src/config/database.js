// src/config/database.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_PATH || './casheye.sqlite';
try {
    const dbDir = path.dirname(dbPath); // Gets the directory part of the path (e.g., '/data')
    if (!fs.existsSync(dbDir)) {
        console.log(`DATABASE_LOG: Directory ${dbDir} does not exist. Creating it...`);
        fs.mkdirSync(dbDir, { recursive: true }); // 'recursive: true' creates parent directories if needed
        console.log(`DATABASE_LOG: Successfully created directory ${dbDir}.`);
    }
} catch (error) {
    console.error("DATABASE_LOG_FATAL: Could not create directory for database.", error);
    // If we can't create the directory, the app can't run, so we should exit.
    process.exit(1);
}
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log(`Connected to the SQLite database at ${dbPath}`);
        // Enable foreign key support
        db.exec('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
                console.error("Failed to enable foreign key support:", err);
            } else {
                console.log("Foreign key support enabled.");
            }
        });
    }
});

const initTables = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users Table
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    balance REAL DEFAULT 0.00,
                    referralCode TEXT UNIQUE,
                    referredBy INTEGER, -- User ID of the referrer
                    status TEXT DEFAULT 'Active', -- Active, Blocked
                    lastCheckIn TIMESTAMP,
                    hasMadeFirstInvestment BOOLEAN DEFAULT FALSE,
                    activePlanId INTEGER, -- Link to investment_plans table
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referredBy) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (activePlanId) REFERENCES investment_plans(id) ON DELETE SET NULL
                )
            `, (err) => { if (err) return reject(err); console.log("Users table checked/created."); });

            // Admins Table
            db.run(`
                CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    isDefault BOOLEAN DEFAULT FALSE,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { if (err) return reject(err); console.log("Admins table checked/created."); });

            // Investment Plans Table
            db.run(`
                CREATE TABLE IF NOT EXISTS investment_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    investmentAmount REAL NOT NULL,
                    dailyReturn REAL NOT NULL,
                    durationDays INTEGER NOT NULL,
                    description TEXT,
                    isActive BOOLEAN DEFAULT TRUE,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TIMESTAMP 

                )
            `, (err) => { if (err) return reject(err); console.log("Investment plans table checked/created (with updatedAt)."); });

            // Transactions Table
            db.run(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    userId INTEGER NOT NULL,
                    type TEXT NOT NULL, -- Deposit, Withdrawal, Investment, Daily Earnings, Referral Bonus, Admin Adjustment
                    amount REAL NOT NULL,
                    status TEXT NOT NULL, -- Pending, Approved, Rejected, Completed
                    description TEXT,
                    method TEXT, -- Easypaisa, JazzCash, Platform
                    accountNumber TEXT, -- For withdrawals
                    transactionIdExternal TEXT, -- TID from user for deposit
                    screenshotUrl TEXT, -- Path to uploaded screenshot
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    adminProcessedBy INTEGER, -- Admin ID who approved/rejected
                    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (adminProcessedBy) REFERENCES admins(id) ON DELETE SET NULL
                )
            `, (err) => { if (err) return reject(err); console.log("Transactions table checked/created."); });

            // Platform Settings (simple key-value for now, or dedicated table)
            // For deposit accounts, a JSON string might be stored or separate fields.
            // Using a simple key-value store table:
            db.run(`
                CREATE TABLE IF NOT EXISTS platform_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT -- Store JSON strings for complex settings like deposit accounts
                )
            `, (err) => {
                if (err) return reject(err);
                console.log("Platform settings table checked/created.");
                // Insert default deposit account settings if not present
                const defaultDepositSettings = {
                    easypaisa: { name: "EP Default Name", number: "03001234567", instructions: "Send to this EP account." },
                    jazzcash: { name: "JC Default Name", number: "03017654321", instructions: "Send to this JC account." }
                };
                db.run(
                    "INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)",
                    ['deposit_accounts', JSON.stringify(defaultDepositSettings)],
                    (err) => { if (err) console.error("Error setting default deposit accounts:", err); }
                );
            });

            // Placeholder for seeding some initial investment plans (example)
            db.get("SELECT COUNT(*) as count FROM investment_plans", (err, row) => {
                if (err) return reject(err);
                if (row.count === 0) {
                    db.run("INSERT INTO investment_plans (name, investmentAmount, dailyReturn, durationDays, description) VALUES (?, ?, ?, ?, ?)",
                        ["Starter Pack", 500, 25, 30, "Great for beginners to get started."],
                        (err) => { if(err) console.error("Error seeding plan 1", err); }
                    );
                    db.run("INSERT INTO investment_plans (name, investmentAmount, dailyReturn, durationDays, description) VALUES (?, ?, ?, ?, ?)",
                        ["Pro Investor", 2000, 110, 45, "Higher returns for serious investors."],
                        (err) => { if(err) console.error("Error seeding plan 2", err); }
                    );
                    console.log("Initial investment plans seeded.");
                }
                resolve();
            });
        });
    });
};

module.exports = { db, initTables };