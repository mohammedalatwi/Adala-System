const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');
const { authLimiter, passwordChangeLimiter } = require('../middleware/rateLimiter');

// Routes المصادقة
router.post('/register', 
    authLimiter,
    validationMiddleware.validateRegister,
    authController.register
);

router.post('/login',
    authLimiter,
    validationMiddleware.validateLogin,
    authController.login
);

router.put('/password',
    passwordChangeLimiter,
    authMiddleware.requireAuth,
    validationMiddleware.validateChangePassword,
    authController.changePassword
);

router.post('/logout', authController.logout);
router.get('/status', authController.getAuthStatus);
router.get('/check-username/:username', authController.checkUsername);
router.get('/check-email/:email', authController.checkEmail);

module.exports = router;