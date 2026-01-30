const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إعداد التخزين للوجو
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './frontend/public/uploads/branding';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('فقط ملفات الصور مسموحة (JPG, PNG, SVG)'));
    }
});

// المسارات
router.get('/', authMiddleware.requireAuth, settingsController.getSettings);
router.post('/', authMiddleware.requireAuth, settingsController.updateSettings);
router.post('/logo', authMiddleware.requireAuth, upload.single('logo'), settingsController.uploadLogo);

// إعدادات التنبيهات
router.get('/notifications', authMiddleware.requireAuth, settingsController.getNotificationSettings);
router.post('/notifications', authMiddleware.requireAuth, settingsController.updateNotificationSettings);

module.exports = router;
