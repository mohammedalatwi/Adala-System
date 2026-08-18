const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const authMiddleware = require('../middleware/auth');

// مسارات التصدير
router.get('/case/:id/pdf', authMiddleware.requireAuth, exportController.exportCasePDF);
router.get('/finance/pdf', authMiddleware.requireAuth, exportController.exportFinancePDF);
router.get('/finance/summary', authMiddleware.requireAuth, exportController.exportFinancialSummary);
router.get('/finance/excel', authMiddleware.requireAuth, exportController.exportInvoicesExcel);
router.get('/reports/excel', authMiddleware.requireAuth, exportController.exportReportsExcel);

module.exports = router;
