// src/routes/platformRoutes.js
const express = require('express');
const router = express.Router();
const platformController = require('../controllers/platformController');
// No protection needed for viewing plans or deposit info usually, but you can add protectUser if needed
// const { protectUser } = require('../middleware/authMiddleware');

// GET /api/platform/plans
router.get('/plans', platformController.getInvestmentPlans);

// GET /api/platform/deposit-info
router.get('/deposit-info', platformController.getDepositInfo);

module.exports = router;