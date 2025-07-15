// src/routes/authUserRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

const userLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many login attempts from this IP, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { message: 'Too many accounts created from this IP, please try again after an hour.'},
    standardHeaders: true,
    legacyHeaders: false,
});

const signupValidationRules = [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ min: 2, max: 50 }),
    body('email').trim().isEmail().withMessage('Please provide a valid email address.').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
    body('referralCode').optional({ checkFalsy: true }).trim().isAlphanumeric().withMessage('Referral code should only contain letters and numbers.')
];

const loginValidationRules = [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.')
];

router.post('/signup', signupLimiter, signupValidationRules, handleValidationErrors, authController.signup);
router.post('/login', userLoginLimiter, loginValidationRules, handleValidationErrors, authController.login);

module.exports = router;