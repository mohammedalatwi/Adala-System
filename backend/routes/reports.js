/**
 * reports.js - routes التقارير
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes التقارير
router.get('/cases', reportController.generateCasesReport);
router.get('/performance', reportController.generatePerformanceReport);
router.get('/sessions', reportController.generateSessionsReport);
router.get('/financial', reportController.generateFinancialReport);
router.get('/system-stats', reportController.getSystemStats);

module.exports = router;