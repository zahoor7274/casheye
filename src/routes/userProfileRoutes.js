// src/routes/userProfileRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator'); // Import body
const { handleValidationErrors } = require('../middleware/validationHandler');

// Import the controller and middleware
const userController = require('../controllers/userController');
const { protectUser } = require('../middleware/authMiddleware');

// Define the routes

// GET /api/users/profile - Protected Route: Fetches the logged-in user's profile
router.get('/profile', protectUser, userController.getUserProfile);

const changePasswordValidationRules = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .notEmpty().withMessage('New password is required.')
        .isLength({ min: 6, max: 100 }).withMessage('New password must be between 6 and 100 characters.')
        .custom((value, { req }) => { // Custom validator
            if (value === req.body.currentPassword) {
                throw new Error('New password cannot be the same as the current password.');
            }
            return true;
        })
];
// (The actual logic for changePassword is still a stub in userController.js)
router.post('/change-password', protectUser, changePasswordValidationRules, handleValidationErrors, userController.changePassword);

// GET /api/users/referrals - Protected Route: Fetches users referred by the logged-in user
// (The actual logic for getReferrals is still a stub in userController.js)
router.get('/referrals', protectUser, userController.getReferrals);

// GET /api/users/check-in-status - Protected Route: Checks if the user can perform daily check-in
router.get('/check-in-status', protectUser, userController.getCheckInStatus);

// POST /api/users/check-in - Protected Route: Allows user to perform daily check-in
router.post('/check-in', protectUser, userController.performCheckIn);

module.exports = router;