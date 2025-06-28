// src/routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));
    return res.status(422).json({ message: "Validation failed.", errors: extractedErrors });
};

const adminLoginValidationRules = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required.'),
    body('password')
        .notEmpty().withMessage('Password is required.')
];

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Only 5 admin login attempts per 15 minutes
    message: { message: 'Too many admin login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
// POST /api/admin/auth/login
router.post('/login', adminLoginLimiter, adminLoginValidationRules, validate, adminAuthController.adminLogin);

module.exports = router;