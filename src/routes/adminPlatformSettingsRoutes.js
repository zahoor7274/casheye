// src/routes/adminPlatformSettingsRoutes.js
const express = require('express');
const router = express.Router();
const adminPlatformSettingsController = require('../controllers/adminPlatformSettingsController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

router.get('/settings/deposit-accounts', protectAdmin, adminPlatformSettingsController.getDepositAccountSettings);

const depositAccountSettingsValidationRules = [
    body('easypaisa.name').trim().notEmpty(),
    body('easypaisa.number').trim().notEmpty(),
    body('easypaisa.instructions').trim().isString(),
    body('jazzcash.name').trim().notEmpty(),
    body('jazzcash.number').trim().notEmpty(),
    body('jazzcash.instructions').trim().isString(),
];
router.put('/settings/deposit-accounts', protectAdmin, depositAccountSettingsValidationRules, handleValidationErrors, adminPlatformSettingsController.updateDepositAccountSettings);

router.get('/settings/investment-plans', protectAdmin, adminPlatformSettingsController.getAdminInvestmentPlans);

const createPlanValidationRules = [
    body('name').trim().notEmpty().isLength({min:3, max: 100}),
    body('investmentAmount').isFloat({ gt: 0 }),
    body('dailyReturn').isFloat({ gt: -0.000001 }),
    body('durationDays').isInt({ gt: 0 }),
    body('description').optional({ checkFalsy: true }).trim().isString(),
    body('isActive').optional().isBoolean()
];
router.post('/settings/investment-plans', protectAdmin, createPlanValidationRules, handleValidationErrors, adminPlatformSettingsController.createInvestmentPlan);

const updatePlanValidationRules = [
    param('planId').isInt({ gt: 0 }),
    body('name').optional().trim().notEmpty().isLength({min:3, max: 100}),
    body('investmentAmount').optional().isFloat({ gt: 0 }),
    body('dailyReturn').optional().isFloat({ gt: -0.000001 }),
    body('durationDays').optional().isInt({ gt: 0 }),
    body('description').optional({ nullable: true, checkFalsy: false }).trim().isString(),
    body('isActive').optional().isBoolean()
];
router.put('/settings/investment-plans/:planId', protectAdmin, updatePlanValidationRules, handleValidationErrors, adminPlatformSettingsController.updateInvestmentPlan);

module.exports = router;