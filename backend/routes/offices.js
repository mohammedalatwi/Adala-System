const express = require('express');
const router = express.Router();
const officeController = require('../controllers/officeController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إعداد التخزين للشعار
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/logos');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'office-' + req.session.officeId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('فقط ملفات الصور مسموح بها (JPG, PNG, SVG)'));
    }
});

// ✅ جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// ✅ Routes إعدادات المكتب
router.get('/settings', officeController.getOfficeSettings);
router.put('/settings', officeController.updateOfficeSettings);
router.post('/logo', upload.single('logo'), officeController.uploadLogo);

module.exports = router;
