// src/routes/adminTransactionRoutes.js
const express = require('express');
const router = express.Router();
const adminTransactionController = require('../controllers/adminTransactionController');
const { protectAdmin } = require('../middleware/authMiddleware');
const { param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validationHandler');

// All routes protected by admin authentication

// --- Deposits ---
const transactionIdParamValidationRules = [
    param('transactionId')
        .isInt({ gt: 0 }).withMessage('Transaction ID must be a positive integer.')
];

router.get('/deposits/pending', protectAdmin, adminTransactionController.listPendingDeposits);
router.post(
    '/deposits/:transactionId/approve',
    protectAdmin,
    transactionIdParamValidationRules,
    handleValidationErrors,
    adminTransactionController.approveDeposit
);
router.post(
    '/deposits/:transactionId/reject',
    protectAdmin,
    transactionIdParamValidationRules,
    handleValidationErrors,
    adminTransactionController.rejectDeposit
);

router.get('/withdrawals/pending', protectAdmin, adminTransactionController.listPendingWithdrawals);
router.post(
    '/withdrawals/:transactionId/approve',
    protectAdmin,
    transactionIdParamValidationRules,
    handleValidationErrors,
    adminTransactionController.approveWithdrawal
);
router.post(
    '/withdrawals/:transactionId/reject',
    protectAdmin,
    transactionIdParamValidationRules,
    handleValidationErrors,
    adminTransactionController.rejectWithdrawal
);

const listAllTransactionsValidationRules = [
    query('search')
        .optional()
        .trim()
];
router.get(
    '/all',
    protectAdmin,
    listAllTransactionsValidationRules,
    handleValidationErrors,
    adminTransactionController.listAllTransactions
);

module.exports = router;