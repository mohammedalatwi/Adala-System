const db = require('../db/database');
const ActivityService = require('../services/ActivityService');
const NotificationService = require('../services/NotificationService');

// المسارات المستثناة من حظر كلمة المرور المؤقتة. الاستثناءات الثلاثة فقط هي ما
// يحتاجه المستخدم المحظور للخروج من الحظر أو لفهم سببه:
//   PUT /auth/password → مسار الخروج من الحظر نفسه (بدونه يصبح الحظر أبديًا)
//   POST /auth/logout  → يجب أن يبقى بمقدوره الخروج من الجلسة دائمًا
//   GET /auth/status   → حتى تعرف الواجهة حالته فتحوّله لصفحة تغيير كلمة المرور
//                        بدل أن تصطدم بـ403 بلا تفسير
// المسارات مكتوبة بلا بادئة /api لأن الـ middleware يُركَّب عبر app.use('/api', ...)
// فتُزال البادئة من req.path داخله.
const PASSWORD_CHANGE_EXEMPT_ROUTES = [
    { method: 'PUT', path: '/auth/password' },
    { method: 'POST', path: '/auth/logout' },
    { method: 'GET', path: '/auth/status' }
];

class AuthMiddleware {
    constructor() {
        this.db = db;
    }

    // ✅ التحقق من تسجيل الدخول
    requireAuth = (req, res, next) => {
        if (!req.session.userId) {
            if (req.xhr || (req.headers.accept || '').indexOf('json') > -1) {
                return res.status(401).json({
                    success: false,
                    message: 'يجب تسجيل الدخول للوصول إلى هذا المورد'
                });
            }
            return res.redirect('/login');
        }
        next();
    };

    // ✅ التحقق من الصلاحيات
    requireRole = (roles) => {
        return async (req, res, next) => {
            if (!req.session.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'يجب تسجيل الدخول'
                });
            }

            try {
                const user = await this.db.get(
                    'SELECT role FROM users WHERE id = ? AND is_active = 1',
                    [req.session.userId]
                );

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: 'المستخدم غير موجود'
                    });
                }

                if (!roles.includes(user.role)) {
                    return res.status(403).json({
                        success: false,
                        message: 'غير مصرح بالوصول'
                    });
                }

                next();
            } catch (error) {
                console.error('Error checking role:', error);
                return res.status(500).json({
                    success: false,
                    message: 'خطأ في التحقق من الصلاحيات'
                });
            }
        };
    };

    // ✅ حظر المستخدم صاحب كلمة المرور المؤقتة من كل شيء عدا تغييرها
    // يُركَّب عالميًا على /api في server.js، فيغطي كل المسارات المحمية بلا استثناء
    // حسب الدور — الأدمن نفسه يُحظر لو كان must_change_password = 1.
    requireNoPendingPasswordChange = async (req, res, next) => {
        // الطلبات غير المصادَق عليها تمرّ ليتولاها requireAuth داخل كل راوتر
        if (!req.session.userId) {
            return next();
        }

        // req.path هنا بلا بادئة /api (يزيلها express عند app.use('/api', ...)).
        // المقارنة بحروف صغيرة وبلا شرطة مائلة أخيرة لتطابق سلوك توجيه express
        // الافتراضي (غير حسّاس لحالة الأحرف، ويقبل الشرطة الأخيرة).
        const method = req.method.toUpperCase();
        const path = (req.path || '').toLowerCase().replace(/\/+$/, '') || '/';

        const isExempt = PASSWORD_CHANGE_EXEMPT_ROUTES.some(
            route => route.method === method && route.path === path
        );
        if (isExempt) {
            return next();
        }

        try {
            // تُقرأ من قاعدة البيانات في كل طلب، لا من الجلسة: الأدمن قد ينشئ أو يعيد
            // ضبط حساب بكلمة سر مؤقتة بينما جلسة صاحبه مفتوحة، فتبقى نسخة الجلسة
            // المحفوظة وقت الدخول قديمة (0) ويواصل التصفح بكلمة سر يعرفها شخص آخر.
            // الكلفة استعلام واحد على المفتاح الأساسي، وهو ما يفعله requireRole أصلًا
            // بكل طلب على المسارات المقيّدة بدور.
            const user = await this.db.get(
                'SELECT must_change_password FROM users WHERE id = ? AND is_active = 1',
                [req.session.userId]
            );

            if (user && user.must_change_password) {
                return res.status(403).json({
                    success: false,
                    message: 'يجب تغيير كلمة المرور المؤقتة قبل المتابعة',
                    must_change_password: true
                });
            }

            next();
        } catch (error) {
            console.error('Error checking pending password change:', error);
            return res.status(500).json({
                success: false,
                message: 'خطأ في التحقق من حالة كلمة المرور'
            });
        }
    };

    // ✅ تسجيل طلبات API
    requestLogger = (req, res, next) => {
        const timestamp = new Date().toISOString();
        const method = req.method;
        const url = req.url;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';

        console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

        // تسجيل النشاط إذا كان المستخدم مسجل الدخول
        if (req.session.userId) {
            ActivityService.logActivity({
                userId: req.session.userId,
                description: `${method} ${url}`,
                actionType: 'api_request',
                ipAddress: ip,
                userAgent: userAgent,
                officeId: req.session.officeId
            });
        }

        next();
    };

    // ✅ الحصول على معلومات المستخدم الحالي
    getCurrentUser = async (req, res, next) => {
        if (!req.session.userId) {
            return next();
        }

        try {
            const user = await this.db.get(
                `SELECT id, full_name, username, email, phone, role, specialization, 
                        license_number, experience_years, avatar_url, created_at
                 FROM users 
                 WHERE id = ? AND is_active = 1`,
                [req.session.userId]
            );

            if (user) {
                req.currentUser = user;

                // تحديث آخر نشاط
                await this.db.run(
                    'UPDATE users SET last_login = datetime("now") WHERE id = ?',
                    [req.session.userId]
                );
            }
        } catch (error) {
            console.error('Error getting current user:', error);
        }

        next();
    };

    // ✅ التحقق من ملكية المورد
    checkOwnership = (entityType) => {
        return async (req, res, next) => {
            const userId = req.session.userId;
            const officeId = req.session.officeId;

            if (!userId || !officeId) {
                return res.status(401).json({
                    success: false,
                    message: 'يجب تسجيل الدخول'
                });
            }

            try {
                const user = await this.db.get(
                    'SELECT role FROM users WHERE id = ? AND office_id = ?',
                    [userId, officeId]
                );

                if (!user) {
                    return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
                }

                // المديرين يمكنهم الوصول لكل شيء في مكتبهم
                if (user.role === 'admin') {
                    return next();
                }

                let ownershipCheck;
                const entityId = req.params.id;

                switch (entityType) {
                    case 'case':
                        ownershipCheck = await this.db.get(
                            'SELECT id FROM cases WHERE id = ? AND lawyer_id = ? AND office_id = ?',
                            [entityId, userId, officeId]
                        );
                        break;
                    case 'client':
                        ownershipCheck = await this.db.get(
                            'SELECT id FROM clients WHERE id = ? AND created_by = ? AND office_id = ?',
                            [entityId, userId, officeId]
                        );
                        break;
                    case 'session':
                        ownershipCheck = await this.db.get(
                            'SELECT s.id FROM sessions s JOIN cases c ON s.case_id = c.id WHERE s.id = ? AND c.lawyer_id = ? AND s.office_id = ?',
                            [entityId, userId, officeId]
                        );
                        break;
                    default:
                        return res.status(403).json({
                            success: false,
                            message: 'نوع المورد غير معروف'
                        });
                }

                if (!ownershipCheck) {
                    return res.status(403).json({
                        success: false,
                        message: 'غير مصرح بالوصول إلى هذا المورد'
                    });
                }

                next();
            } catch (error) {
                console.error('Error checking ownership:', error);
                return res.status(500).json({
                    success: false,
                    message: 'خطأ في التحقق من الصلاحيات'
                });
            }
        };
    };

    /**
     * @deprecated Use ActivityService.logActivity instead
     */
    async logActivity(...args) {
        return ActivityService.logActivity(...args);
    }

    /**
     * @deprecated Use NotificationService.createNotification instead
     */
    async createNotification(...args) {
        return NotificationService.createNotification(...args);
    }
}

module.exports = new AuthMiddleware();