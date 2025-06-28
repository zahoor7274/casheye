const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const protectUser = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            await new Promise((resolve, reject) => {
                db.get("SELECT id, name, email, status, balance, referralCode, referredBy, lastCheckIn, hasMadeFirstInvestment, activePlanId FROM users WHERE id = ?",
                 [decoded.userId], (err, user) => {
                    if (err) {
                        console.error("DB error in protectUser:", err.message);
                        return reject(new Error('Database error'));
                    }
                    if (!user) {
                        return reject(new Error('User not found'));
                    }
                    if (user.status === 'Blocked') {
                        return reject(new Error('User account is blocked'));
                    }
                    req.user = user;
                    resolve();
                });
            });
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token failed (invalid signature or malformed)' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            } else if (error.message === 'User not found' || error.message === 'User account is blocked') {
                return res.status(401).json({ message: `Not authorized, ${error.message}`});
            }
            res.status(401).json({ message: 'Not authorized, general token issue' });
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

            await new Promise((resolve, reject) => {
                db.get("SELECT id, username FROM admins WHERE id = ?", [decoded.adminId], (err, admin) => {
                    if (err) {
                        console.error("DB error in protectAdmin:", err.message);
                        return reject(new Error('Database error'));
                    }
                    if (!admin) {
                        return reject(new Error('Admin not found'));
                    }
                    req.admin = admin;
                    resolve();
                });
            });
            next();
        } catch (error) {
            console.error('Admin token verification failed:', error.message);
             if (error.name === 'JsonWebTokenError' || error.message === 'Not an admin token') {
                return res.status(401).json({ message: 'Not authorized as admin, token failed' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized as admin, token expired' });
            } else if (error.message === 'Admin not found') {
                return res.status(401).json({ message: `Not authorized, ${error.message}`});
            }
            res.status(401).json({ message: 'Not authorized as admin, general token issue' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized as admin, no token' });
    }
};

module.exports = { protectUser, protectAdmin };