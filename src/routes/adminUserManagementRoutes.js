// src/routes/adminUserManagementRoutes.js
const express = require('express');
const router = express.Router();
const adminUserManagementController = require('../controllers/adminUserManagementController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { query, param, body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

// All routes in this file are protected by protectAdmin
// Validation for listing users (search query)
const listUsersValidationRules = [
    query('search')
        .optional()
        .trim()
];
router.get(
    '/',
    protectAdmin,
    listUsersValidationRules,
    handleValidationErrors,
    adminUserManagementController.listUsers
);

// Validation for userId URL parameter
const userIdParamValidationRules = [
    param('userId')
        .isInt({ gt: 0 }).withMessage('User ID must be a positive integer.')
];

router.get(
    '/:userId/profile',
    protectAdmin,
    userIdParamValidationRules,
    handleValidationErrors,
    adminUserManagementController.getUserProfileForAdmin
);

// PUT /api/admin/users/:userId/profile - Admin updates a user's profile (e.g., name, status, NOT direct balance change)
router.put('/:userId/profile', protectAdmin, adminUserManagementController.updateUserProfileByAdmin);

// POST /api/admin/users/:userId/block - Admin blocks a user
router.post('/:userId/block', protectAdmin, adminUserManagementController.blockUser);

// POST /api/admin/users/:userId/unblock - Admin unblocks a user
router.post('/:userId/unblock', protectAdmin, adminUserManagementController.unblockUser);


module.exports = router;