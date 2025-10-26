const path = require('path');

const config = {
    // إعدادات التطبيق
    app: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        name: 'نظام عدالة - إدارة مكاتب المحاماة'
    },

    // إعدادات قاعدة البيانات
    database: {
        path: process.env.DB_PATH || path.join(__dirname, '../../database/adala.db'),
        backupPath: process.env.DB_BACKUP_PATH || path.join(__dirname, '../../database/backups')
    },

    // إعدادات الجلسة
    session: {
        secret: process.env.SESSION_SECRET || 'adala-secret-key-2024',
        name: 'adala_session',
        maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
    },

    // إعدادات التحميل
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
            'text/plain'
        ],
        uploadPath: process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads')
    },

    // إعدادات البريد الإلكتروني
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE || false,
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || 'noreply@adala.com'
    },

    // إعدادات التطبيق
    features: {
        enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS || false,
        enableFileUpload: process.env.ENABLE_FILE_UPLOAD || true,
        enableBackup: process.env.ENABLE_BACKUP || true,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS || 5,
        sessionTimeout: process.env.SESSION_TIMEOUT || 24 * 60 * 60 * 1000 // 24 ساعة
    }
};

module.exports = config;