const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// ✅ التأكد من وجود مجلد الرفع
const uploadDir = config.upload.uploadPath;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ الامتدادات المسموح بها لكل نوع MIME
// نوع الـ MIME يأتي من المتصفح (من العميل) ويمكن تزويره، لذلك لا يكفي وحده:
// ملف باسم "evil.js" مع mimetype مزوّر "text/plain" كان يُحفظ سابقاً بامتداد .js
// داخل مجلد uploads الذي يُقدّم من نفس الأصل (same-origin)، فيصبح تحميله
// مسموحاً به تحت script-src 'self' — أي ثغرة تلتف على سياسة أمان المحتوى.
// الحل: التحقق من الامتداد الفعلي ومطابقته لنوع الـ MIME المُعلن معاً.
const EXTENSIONS_BY_MIME = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'text/plain': ['.txt']
};

const ALLOWED_EXTENSIONS = [...new Set(Object.values(EXTENSIONS_BY_MIME).flat())];

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
        // الامتداد هنا مُتحقَّق منه مسبقاً في fileFilter ويُكتب بأحرف صغيرة،
        // فلا يُؤخذ امتداد اسم الملف الأصلي كما هو أبداً
        const ext = path.extname(file.originalname).toLowerCase();
        const name = path.basename(file.originalname, path.extname(file.originalname));
        
        // إنشاء اسم ملف آمن
        const safeName = name.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') + '-' + uniqueSuffix + ext;
        cb(null, safeName);
    }
});

// ✅ فلتر أنواع الملفات: نوع الـ MIME + الامتداد الفعلي معاً
const fileFilter = (req, file, cb) => {
    const mimetype = file.mimetype;

    if (!config.upload.allowedTypes.includes(mimetype)) {
        return cb(new Error(`نوع الملف غير مسموح به. الأنواع المسموحة: ${config.upload.allowedTypes.join(', ')}`), false);
    }

    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error(`امتداد الملف غير مسموح به. الامتدادات المسموحة: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
    }

    // يجب أن يطابق الامتداد نوع الـ MIME المُعلن
    // (يمنع رفع ملف .js بادعاء أنه text/plain)
    const expectedExtensions = EXTENSIONS_BY_MIME[mimetype] || [];
    if (!expectedExtensions.includes(ext)) {
        return cb(new Error(`امتداد الملف (${ext}) لا يطابق نوع الملف المُعلن (${mimetype})`), false);
    }

    cb(null, true);
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