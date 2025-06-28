// src/routes/authUserRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Allow 20 signups per hour from an IP
    message: { message: 'Too many accounts created from this IP, please try again after an hour.'},
    standardHeaders: true,
    legacyHeaders: false,
});

const signupValidationRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required.')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters.'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(), // Converts email to a canonical form (e.g., lowercase domain)

    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 6, max: 100 }).withMessage('Password must be between 6 and 100 characters.'),
        // You could add .isStrongPassword() for more complex rules if desired

    body('referralCode')
        .optional({ checkFalsy: true }) // Makes this field optional; checkFalsy means empty strings are also considered "empty"
        .trim()
        .isAlphanumeric().withMessage('Referral code should only contain letters and numbers.')
        .isLength({ min: 6, max: 10 }).withMessage('Referral code must be between 6 and 10 characters if provided.')
];

// Middleware to handle validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next(); // No errors, proceed to the controller
    }
    // Extract error messages
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg })); // 'path' was 'param' in older versions

    return res.status(422).json({ // 422 Unprocessable Entity is often used for validation errors
        message: "Validation failed.",
        errors: extractedErrors
    });
};

// POST /api/auth/signup
router.post('/signup', signupLimiter, signupValidationRules, validate, authController.signup);

const userLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Allow 10 login attempts per 15 minutes for users
    message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
const loginValidationRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Valid email is required.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.')
];


// POST /api/auth/login
router.post('/login', userLoginLimiter, loginValidationRules,validate, authController.login);

module.exports = router;