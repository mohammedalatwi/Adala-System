const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware.requireAuth);

// Invoices
router.post('/invoices', financeController.createInvoice);
router.get('/invoices', financeController.getAllInvoices);
router.post('/payments', financeController.recordPayment);

// Expenses
router.post('/expenses', financeController.createExpense);
router.get('/expenses', financeController.getAllExpenses);

module.exports = router;
