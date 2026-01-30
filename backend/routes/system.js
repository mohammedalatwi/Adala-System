const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// ✅ التحقق من صحة النظام
router.get('/check', systemController.checkHealth);

module.exports = router;
