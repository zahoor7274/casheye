// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const protectUser = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const sql = `
                SELECT id, name, email, status, balance, referralCode, referredBy, 
                       lastCheckIn, hasMadeFirstInvestment, activePlanId 
                FROM users WHERE id = $1
            `;
            const { rows } = await query(sql, [decoded.userId]);
            const user = rows[0];

            if (!user) { throw new Error('User not found'); }
            if (user.status === 'Blocked') { throw new Error('User account is blocked'); }

            req.user = user;
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            // ... your existing error handling for different token errors ...
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const protectAdmin = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded.adminId || decoded.role !== 'admin') {
                throw new Error('Not an admin token');
            }

            const sql = "SELECT id, username FROM admins WHERE id = $1";
            const { rows } = await query(sql, [decoded.adminId]);
            const admin = rows[0];
            
            if (!admin) { throw new Error('Admin not found'); }
            
            req.admin = admin;
            next();
        } catch (error) {
            console.error('Admin token verification failed:', error.message);
            res.status(401).json({ message: 'Not authorized as admin' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized as admin, no token' });
    }
};

module.exports = { protectUser, protectAdmin };