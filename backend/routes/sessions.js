const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes الجلسات
router.post('/',
    validationMiddleware.sanitizeBody,
    validationMiddleware.validateSession,
    sessionController.createSession
);

router.get('/', sessionController.getAllSessions);
router.get('/upcoming', sessionController.getUpcomingSessions);
router.get('/stats', sessionController.getSessionStats);
router.get('/:id', sessionController.getSessionById);
router.put('/:id',
    validationMiddleware.sanitizeBody,
    sessionController.updateSession
);
router.delete('/:id', sessionController.deleteSession);

module.exports = router;