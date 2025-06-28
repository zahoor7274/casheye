// src/routes/adminPlatformSettingsRoutes.js
const express = require('express');
const router = express.Router();
const adminPlatformSettingsController = require('../controllers/adminPlatformSettingsController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

// Validation for deposit account settings
const depositAccountSettingsValidationRules = [
    body('easypaisa.name').trim().notEmpty().withMessage('Easypaisa name is required.'),
    body('easypaisa.number').trim().notEmpty().withMessage(' Easypaisa account Number is required.').isString().withMessage('Easypaisa account number must be a string.'),
    body('easypaisa.instructions').trim().isString().withMessage('Easypaisa instructions must be a string.'), // Can be empty
    body('jazzcash.name').trim().notEmpty().withMessage('JazzCash name is required.'),
    body('jazzcash.number').trim().notEmpty().withMessage('JazzCash number is required.'),
    body('jazzcash.instructions').trim().isString().withMessage('JazzCash instructions must be a string.') // Can be empty
];
router.put(
    '/settings/deposit-accounts',
    protectAdmin,
    depositAccountSettingsValidationRules,
    handleValidationErrors,
    adminPlatformSettingsController.updateDepositAccountSettings
);


router.get('/settings/investment-plans', protectAdmin, adminPlatformSettingsController.getAdminInvestmentPlans);

// Validation for creating an investment plan
const createPlanValidationRules = [
    body('name').trim().notEmpty().withMessage('Plan name is required.')
        .isLength({min:3, max: 100}).withMessage('Plan name must be 3-100 characters.'),
    body('investmentAmount').notEmpty().withMessage('Investment amount is required.')
        .isFloat({ gt: 0 }).withMessage('Investment amount must be a positive number.'),
    body('dailyReturn').notEmpty().withMessage('Daily return is required.')
        .isFloat({ gt: -0.000001 }).withMessage('Daily return must be zero or positive.'), // Allow 0
    body('durationDays').notEmpty().withMessage('Duration is required.')
        .isInt({ gt: 0 }).withMessage('Duration must be a positive integer.'),
    body('description').optional({ checkFalsy: true }).trim().isString(),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.')
];
router.post(
    '/settings/investment-plans',
    protectAdmin,
    createPlanValidationRules,
    handleValidationErrors,
    adminPlatformSettingsController.createInvestmentPlan
);

// Validation for updating an investment plan
const updatePlanValidationRules = [
    param('planId').isInt({ gt: 0 }).withMessage('Plan ID must be a positive integer.'),
    body('name').optional().trim().notEmpty().withMessage('Plan name cannot be empty if provided.')
        .isLength({min:3, max: 100}).withMessage('Plan name must be 3-100 characters.'),
    body('investmentAmount').optional().isFloat({ gt: 0 }).withMessage('Investment amount must be positive if provided.'),
    body('dailyReturn').optional().isFloat({ gt: -0.000001 }).withMessage('Daily return must be zero or positive if provided.'),
    body('durationDays').optional().isInt({ gt: 0 }).withMessage('Duration must be positive if provided.'),
    body('description').optional({ nullable: true, checkFalsy: false }).trim().isString(), // allow null or empty string for description update
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean if provided.')
];
router.put(
    '/settings/investment-plans/:planId',
    protectAdmin,
    updatePlanValidationRules,
    handleValidationErrors,
    adminPlatformSettingsController.updateInvestmentPlan
);

module.exports = router;