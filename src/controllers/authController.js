// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { generateReferralCode } = require('../utils/helpers');
// User Signup
/*exports.signup = async (req, res) => {
    const { name, email, password, referralCode: referredByCode } = req.body; 

    db.get("SELECT email FROM users WHERE email = ?", [email], async (err, row) => {
        if (err) {
            console.error("Signup DB error (check email):", err.message);
            return res.status(500).json({ message: 'Server error during signup.' });
        }
        if (row) {
            return res.status(400).json({ message: 'Email already exists.' });
        }

        let referredByUserId = null;
        if (referredByCode) {
            try {
                const referrer = await new Promise((resolve, reject) => {
                    db.get("SELECT id FROM users WHERE referralCode = ?", [referredByCode], (err, user) => {
                        if (err) reject(err);
                        resolve(user);
                    });
                });
                if (referrer) {
                    referredByUserId = referrer.id;
                } else {
                     // Optional: you might want to inform the user the referral code was invalid
                     console.warn(`Referral code ${referredByCode} not found, proceeding without referrer.`);
                }
            } catch (refErr) {
                console.error("Error checking referrer:", refErr.message);
                // Decide if this should halt signup or just proceed without referrer
            }
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUserReferralCode = generateReferralCode();

            const sql = `INSERT INTO users (name, email, password, referralCode, referredBy, status)
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
            const result = await query(sql, [name, email, hashedPassword, newUserReferralCode, referredByUserId, 'Active'])
            const newUserId = result.rows[0].id;
            res.status(201).json({ message: 'User registered...', userId: newUserId });
        } catch (error) {
            console.error("Signup process error:", error.message);
            res.status(500).json({ message: 'Server error during user registration.' });
        }
    });
};

// User Login
exports.login = (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";
    db.get(sql, [email], async (err, user) => {
        if (err) {
            console.error("Login DB error (find user):", err.message);
            return res.status(500).json({ message: 'Server error during login.' });
        }
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }
        if (user.status === 'Blocked') {
             return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
        }

        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
            }

            const payload = { userId: user.id, email: user.email, name: user.name };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }); // Token expires in 7 days

            res.json({
                message: 'Logged in successfully.',
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                }
            });
        } catch (error) {
            console.error("Login process error (bcrypt/jwt):", error.message);
            res.status(500).json({ message: 'Server error during login processing.' });
        }
    });
};*/
// --- User Signup ---
exports.signup = async (req, res) => {
    try {
        const { name, email, password, referralCode: referredByCode } = req.body;

        // Check if user already exists
        const existingUserResult = await query("SELECT email FROM users WHERE email = $1", [email]);
        if (existingUserResult.rows.length > 0) {
            return res.status(409).json({ message: 'Email already exists.' }); // 409 Conflict is more specific
        }

        // Handle referral code
        let referredByUserId = null;
        if (referredByCode) {
            const referrerResult = await query("SELECT id FROM users WHERE referralCode = $1", [referredByCode]);
            if (referrerResult.rows[0]) {
                referredByUserId = referrerResult.rows[0].id;
            } else {
                console.warn(`Referral code ${referredByCode} not found, proceeding without referrer.`);
            }
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserReferralCode = generateReferralCode();
        
        const insertSql = `
            INSERT INTO users (name, email, password, referralCode, referredBy, status)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `;
        const newUserResult = await query(insertSql, [name, email, hashedPassword, newUserReferralCode, referredByUserId, 'Active']);
        const newUserId = newUserResult.rows[0].id;

        res.status(201).json({
            message: 'User registered successfully! Please login.',
            userId: newUserId,
            email: email
        });

    } catch (error) {
        console.error("SIGNUP_ERROR:", error.message, error.stack);
        res.status(500).json({ message: 'Could not register user due to a server error.' });
    }
};

// --- User Login ---
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const sql = "SELECT * FROM users WHERE email = $1";
        const { rows } = await query(sql, [email]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials. User not found.' });
        }
        if (user.status === 'Blocked') {
            return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials. Password incorrect.' });
        }
        
        if (!process.env.JWT_SECRET) {
            console.error("FATAL: JWT_SECRET environment variable is NOT SET!");
            return res.status(500).json({ message: 'Server configuration error.' });
        }

        const payload = { userId: user.id, email: user.email, name: user.name };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            message: 'Logged in successfully.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (error) {
        console.error("LOGIN_ERROR:", error.message, error.stack);
        res.status(500).json({ message: 'Server error during login processing.' });
    }
};