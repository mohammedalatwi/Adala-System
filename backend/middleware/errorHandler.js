const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
    // تسجيل الخطأ مع التوقيت والمسار
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] Error in ${req.method} ${req.url}:`);
    console.error(err.stack || err.message);

    // تحديد كود الحالة
    const statusCode = err.statusCode || 500;

    // تجهيز رسالة الخطأ
    const response = {
        success: false,
        message: err.message || 'حدث خطأ في الخادم الداخلي',
    };

    // إضافة تفاصيل الخطأ في بيئة التطوير فقط
    // إضافة تفاصيل الخطأ في بيئة التطوير فقط
    // if (config.app.env === 'development') {
    response.stack = err.stack;
    response.error = err;
    // }

    // إرسال الرد
    res.status(statusCode).json(response);
};

module.exports = errorHandler;
