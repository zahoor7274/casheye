// src/routes/userProfileRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protectUser } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

router.get('/profile', protectUser, userController.getUserProfile);
router.get('/referrals', protectUser, userController.getReferrals);
router.get('/check-in-status', protectUser, userController.getCheckInStatus);
router.post('/check-in', protectUser, userController.performCheckIn);

const changePasswordValidationRules = [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password cannot be the same as the current password.');
            }
            return true;
        })
];

router.post('/change-password', protectUser, changePasswordValidationRules, handleValidationErrors, userController.changePassword);

module.exports = router;