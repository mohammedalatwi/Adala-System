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
 * محدد محاولات تغيير كلمة المرور — نفس صرامة authLimiter (5 محاولات/15 دقيقة لكل IP)،
 * لكن بعدّاد مستقل خاص به. مسار تغيير كلمة المرور يتحقق من current_password عبر
 * bcrypt.compare بنفس حساسية مسار تسجيل الدخول (مهاجم سرق جلسة المستخدم قد يحاول
 * تخمين كلمة سره الحالية للاستيلاء الكامل على الحساب)، فيستحق نفس مستوى الحماية.
 * لكن استخدام عدّاد مستقل (لا نفس authLimiter) متعمّد: محاولات دخول فاشلة لا يجب أن
 * تستهلك من رصيد محاولات تغيير كلمة المرور لمستخدم مسجّل دخوله فعلًا، فكل مسار له
 * نموذج تهديد مختلف يستحق ميزانية محاولات خاصة به.
 */
const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 5, // 5 محاولات كحد أقصى لكل عنوان IP
    message: {
        success: false,
        message: 'لقد تجاوزت الحد الأقصى للمحاولات المسموح بها. يرجى المحاولة مرة أخرى بعد 15 دقيقة لحماية حسابك.'
    },
    standardHeaders: true,
    legacyHeaders: false,
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
    passwordChangeLimiter,
    apiLimiter
};
