const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes لوحة التحكم
router.get('/data', dashboardController.getDashboardData);
router.get('/notifications', dashboardController.getNotifications);
router.get('/activities', dashboardController.getRecentActivities);
router.put('/notifications/:id/read', dashboardController.markNotificationAsRead);

module.exports = router;