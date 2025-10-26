const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// ✅ التأكد من وجود مجلد الرفع
const uploadDir = config.upload.uploadPath;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ إعدادات التخزين
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const caseId = req.body.case_id || 'general';
        const caseDir = path.join(uploadDir, `case_${caseId}`);
        
        if (!fs.existsSync(caseDir)) {
            fs.mkdirSync(caseDir, { recursive: true });
        }
        
        cb(null, caseDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        
        // إنشاء اسم ملف آمن
        const safeName = name.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') + '-' + uniqueSuffix + ext;
        cb(null, safeName);
    }
});

// ✅ فلتر أنواع الملفات
const fileFilter = (req, file, cb) => {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`نوع الملف غير مسموح به. الأنواع المسموحة: ${config.upload.allowedTypes.join(', ')}`), false);
    }
};

// ✅ إعداد multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.upload.maxFileSize
    }
});

// ✅ وسيط معالجة أخطاء الرفع
const handleUploadErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: `حجم الملف كبير جداً. الحد الأقصى هو ${config.upload.maxFileSize / 1024 / 1024}MB`
            });
        }
        
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'تم تجاوز الحد الأقصى لعدد الملفات'
            });
        }
        
        return res.status(400).json({
            success: false,
            message: `خطأ في رفع الملف: ${err.message}`
        });
    }
    
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    next();
};

// ✅ وسيط التحقق من الملفات المرفوعة
const validateUploadedFiles = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'لم يتم رفع أي ملفات'
        });
    }
    
    // التحقق من كل ملف
    for (const file of req.files) {
        if (file.size === 0) {
            return res.status(400).json({
                success: false,
                message: `الملف ${file.originalname} فارغ`
            });
        }
        
        if (file.size > config.upload.maxFileSize) {
            return res.status(400).json({
                success: false,
                message: `الملف ${file.originalname} يتجاوز الحجم المسموح`
            });
        }
    }
    
    next();
};

module.exports = {
    upload,
    handleUploadErrors,
    validateUploadedFiles
};