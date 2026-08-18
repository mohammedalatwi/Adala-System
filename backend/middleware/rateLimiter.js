const rateLimit = require('express-rate-limit');

/**
 * محدد محاولات المصادقة (تسجيل الدخول والتسجيل الجديد)
 * يسمح بـ 5 محاولات كحد أقصى لكل 15 دقيقة لمنع هجمات التخمين Brute-Force
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 5, // 5 محاولات كحد أقصى لكل عنوان IP
    message: {
        success: false,
        message: 'لقد تجاوزت الحد الأقصى للمحاولات المسموح بها. يرجى المحاولة مرة أخرى بعد 15 دقيقة لحماية حسابك.'
    },
    standardHeaders: true, // إرجاع معلومات حد المعدل في ترويسات RateLimit-*
    legacyHeaders: false, // إيقاف الترويسات القديمة X-RateLimit-*
});

/**
 * محدد الطلبات العام للـ API لحماية السيرفر وقاعدة البيانات من هجمات DoS
 * يسمح بـ 100 طلب كحد أقصى لكل 15 دقيقة لكل عنوان IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100, // 100 طلب كحد أقصى
    message: {
        success: false,
        message: 'تم تقييد الطلبات مؤقتاً بسبب كثرة الاستدعاءات المرسلة من هذا الجهاز. يرجى المحاولة لاحقاً.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    apiLimiter
};
