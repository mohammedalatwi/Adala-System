const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes المستخدمين
router.get('/', userController.getAllUsers);
router.get('/stats', userController.getUserStats);
router.get('/:id', userController.getUserById);
router.post('/',
    authMiddleware.requireRole(['admin']),
    validationMiddleware.validateRegister,
    userController.createUser
);
router.put('/:id',
    validationMiddleware.sanitizeBody,
    userController.updateUser
);
router.delete('/:id',
    authMiddleware.requireRole(['admin']),
    userController.deleteUser
);
router.put('/:id/status', userController.updateUserStatus);

module.exports = router;