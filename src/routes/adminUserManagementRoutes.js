// src/routes/adminUserManagementRoutes.js
const express = require('express');
const router = express.Router();
const adminUserManagementController = require('../controllers/adminUserManagementController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { query, param, body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

const listUsersValidationRules = [
    query('search').optional().trim()
];
router.get('/', protectAdmin, listUsersValidationRules, handleValidationErrors, adminUserManagementController.listUsers);

const userIdParamValidationRules = [
    param('userId').isInt({ gt: 0 }).withMessage('User ID must be a positive integer.')
];

router.get('/:userId/profile', protectAdmin, userIdParamValidationRules, handleValidationErrors, adminUserManagementController.getUserProfileForAdmin);

const updateUserProfileAdminValidationRules = [
    param('userId').isInt({ gt: 0 }),
    body('name').optional().trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('status').optional().isIn(['Active', 'Blocked'])
];
router.put('/:userId/profile', protectAdmin, updateUserProfileAdminValidationRules, handleValidationErrors, adminUserManagementController.updateUserProfileByAdmin);

router.post('/:userId/block', protectAdmin, userIdParamValidationRules, handleValidationErrors, adminUserManagementController.blockUser);
router.post('/:userId/unblock', protectAdmin, userIdParamValidationRules, handleValidationErrors, adminUserManagementController.unblockUser);

module.exports = router;