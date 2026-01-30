const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/auth');

// جميع هذه المسارات تتطلب صلاحية محامي أو أدمن
const allowedRoles = ['admin', 'lawyer'];

router.get('/', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), teamController.getMyTeam);
router.post('/add', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), teamController.addTrainee);
router.delete('/:id', authMiddleware.requireAuth, authMiddleware.requireRole(allowedRoles), teamController.removeMember);

module.exports = router;
