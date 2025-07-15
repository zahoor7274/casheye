// src/routes/platformRoutes.js
const express = require('express');
const router = express.Router();
const platformController = require('../controllers/platformController');

router.get('/plans', platformController.getInvestmentPlans);
router.get('/deposit-info', platformController.getDepositInfo);

module.exports = router;