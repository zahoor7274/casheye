// src/routes/transactionUserRoutes.js
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protectUser } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

// Validation rules for investment
/*const investValidationRules = [
    body('planId')
        .notEmpty().withMessage('Plan ID is required.')
        .isInt({ gt: 0 }).withMessage('Plan ID must be a positive integer.')
];
router.post('/invest', protectUser, investValidationRules, handleValidationErrors, transactionController.investInPlan);

// Validation rules for deposit
const depositValidationRules = [
    body('amount')
        .notEmpty().withMessage('Amount is required.')
        .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('method')
        .trim()
        .notEmpty().withMessage('Payment method is required.')
        .isIn(['Easypaisa', 'JazzCash']).withMessage('Invalid payment method. Use Easypaisa or JazzCash.'),
    body('transactionId') // This is transactionIdExternal
        .trim()
        .notEmpty().withMessage('Transaction ID (TID/TrxID) is required.')
        .isLength({ min: 3, max: 50 }).withMessage('Transaction ID must be between 3 and 50 characters.')
    // Screenshot validation is primarily handled by Multer's fileFilter and limits
];
router.post(
    '/deposit',
    protectUser,
    transactionController.uploadScreenshot, // Multer first
    depositValidationRules,                 // Then validation rules
    handleValidationErrors,
    transactionController.requestDeposit
);

// Validation rules for withdrawal
const withdrawalValidationRules = [
    body('amount')
        .notEmpty().withMessage('Amount is required.')
        .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('method')
        .trim()
        .notEmpty().withMessage('Withdrawal method is required.')
        .isIn(['Easypaisa', 'JazzCash']).withMessage('Invalid withdrawal method. Use Easypaisa or JazzCash.'),
    body('accountNumber')
        .trim()
        .notEmpty().withMessage('Account number is required.')
        .isLength({ min: 10, max: 15 }).withMessage('Account number seems invalid.') // Adjust length as needed
        .isNumeric().withMessage('Account number must be numeric.')
];
router.post(
    '/withdraw',
    protectUser,
    withdrawalValidationRules,
    handleValidationErrors,
    transactionController.requestWithdrawal
);

// GET /api/transactions/history - User gets their transaction history
router.get('/history', protectUser, transactionController.getTransactionHistory);


module.exports = router;*/
// --- Validation Rules for Investing in a Plan ---
const investValidationRules = [
    body('planId')
        .notEmpty().withMessage('Plan ID is required.')
        .isInt({ gt: 0 }).withMessage('Plan ID must be a positive integer.')
        // We convert to a number in the controller, so this is good.
];

// Apply validation to the route
router.post(
    '/invest',
    protectUser,
    investValidationRules,
    handleValidationErrors,
    transactionController.investInPlan
);


// --- Validation Rules for Requesting a Deposit ---
const depositValidationRules = [
    body('amount')
        .notEmpty().withMessage('Amount is required.')
        .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    
    body('method')
        .trim()
        .notEmpty().withMessage('Payment method is required.')
        // This list should contain the 'name' values of your configured deposit methods
        .isIn(['Easypaisa', 'JazzCash'])
        .withMessage('Invalid payment method specified.'),

    body('transactionId') // This is the 'transactionId' key sent from the frontend
        .trim()
        .notEmpty().withMessage('Transaction ID (TID/TrxID) is required.')
        .isLength({ min: 3, max: 100 }).withMessage('Transaction ID must be between 3 and 100 characters.')
        // A crypto TxHash can be long, so max length is generous.
];

// Apply validation to the route
router.post(
    '/deposit',
    protectUser,
    transactionController.uploadScreenshot, // Multer runs first to handle the file
    depositValidationRules,                 // Then we validate the text fields
    handleValidationErrors,
    transactionController.requestDeposit
);


// --- Validation Rules for Requesting a Withdrawal ---
const withdrawalValidationRules = [
    body('amount')
        .notEmpty().withMessage('Amount is required.')
        .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),

    body('method')
        .trim()
        .notEmpty().withMessage('Withdrawal method is required.')
        .isIn(['Easypaisa', 'JazzCash'])
        .withMessage('Invalid withdrawal method specified.'),

    body('accountNumber')
        .trim()
        .notEmpty().withMessage('Account number is required.')
        .isLength({ min: 11, max: 50 }).withMessage('Account number length is invalid.')
        // A simple string check is best here since it could be a phone number or a crypto address.
        .isString()
];

// Apply validation to the route
router.post(
    '/withdraw',
    protectUser,
    withdrawalValidationRules,
    handleValidationErrors,
    transactionController.requestWithdrawal
);


// --- No validation needed for GET history ---
router.get('/history', protectUser, transactionController.getTransactionHistory);


module.exports = router;