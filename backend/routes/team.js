const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// جميع هذه المسارات تتطلب صلاحية محامي أو أدمن
const allowedRoles = ['admin', 'lawyer'];

router.get('/', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), teamController.getMyTeam);
// متاح لأي دور مسجّل دخول (وليس فقط admin/lawyer) لأن أي مستخدم قد يحتاج إسناد قضية لمحامٍ عند الإنشاء
router.get('/lawyers', authMiddleware.requireAuth, teamController.getLawyers);
router.post('/add', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), validationMiddleware.validateRegister, teamController.addTrainee);
router.delete('/:id', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), teamController.removeMember);

module.exports = router;
