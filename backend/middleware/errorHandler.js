const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
    // تسجيل الخطأ مع التوقيت والمسار
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] Error in ${req.method} ${req.url}:`);

    // In production, we don't want to leak full stack traces
    const isDev = config.app.env === 'development';

    if (isDev) {
        console.error(err.stack || err.message);
    } else {
        console.error(err.message);
    }

    // تحديد كود الحالة
    const statusCode = err.statusCode || (err.message.includes('غير مصرح') ? 403 : 500);

    // تجهيز رسالة الخطأ
    const response = {
        success: false,
        message: err.message || 'حدث خطأ في الخادم الداخلي',
    };

    // إضافة تفاصيل الخطأ في بيئة التطوير فقط
    if (isDev) {
        response.stack = err.stack;
        response.details = err.details || null;
    }

    // إرسال الرد
    res.status(statusCode).json(response);
};

module.exports = errorHandler;
