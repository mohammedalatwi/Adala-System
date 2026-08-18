const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

const authMiddleware = require('../middleware/auth');

// ✅ التحقق من صحة النظام
router.get('/check', systemController.checkHealth);
router.post('/manual-check', authMiddleware.requireAuth, systemController.triggerManualCheck);

module.exports = router;
