// src/routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.get('/stats', protectAdmin, adminDashboardController.getDashboardStats);

module.exports = router;