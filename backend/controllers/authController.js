const AuthService = require('../services/AuthService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class AuthController extends BaseController {
    // ✅ تسجيل مستخدم جديد
    register = this.asyncWrapper(async (req, res) => {
        const result = await AuthService.register(req.body);
        this.sendCreated(res, result, 'تم إنشاء الحساب والمكتب بنجاح');
    });

    // ✅ تسجيل الدخول
    login = this.asyncWrapper(async (req, res) => {
        const { email, password } = req.body;
        const user = await AuthService.login(email, password);

        // إنشاء الجلسة
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.officeId = user.office_id;

        this.sendSuccess(res, {
            user: {
                id: user.id,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                role: user.role,
                specialization: user.specialization,
                client_id: user.client_id,
                office_id: user.office_id
            }
        }, 'تم تسجيل الدخول بنجاح');
    });

    // ✅ تسجيل الخروج
    logout = this.asyncWrapper(async (req, res) => {
        req.session.destroy((err) => {
            if (err) throw new Error('فشل في تسجيل الخروج');
            res.json({ success: true, message: 'تم تسجيل الخروج' });
        });
    });

    // ✅ الحصول على حالة المصادقة
    getAuthStatus = this.asyncWrapper(async (req, res) => {
        if (!req.session.userId) {
            return res.json({ authenticated: false, user: null });
        }

        const user = await db.get(
            `SELECT id, full_name, username, email, role, specialization, client_id, office_id,
                    avatar_url, created_at 
             FROM users 
             WHERE id = ? AND is_active = 1`,
            [req.session.userId]
        );

        if (!user) {
            req.session.destroy();
            return res.json({ authenticated: false, user: null });
        }

        res.json({ authenticated: true, user: user });
    });

    // ✅ التحقق من اسم المستخدم
    checkUsername = this.asyncWrapper(async (req, res) => {
        const { username } = req.params;
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        res.json({
            available: !existingUser,
            message: existingUser ? 'اسم المستخدم موجود مسبقاً' : 'اسم المستخدم متاح'
        });
    });

    // ✅ التحقق من البريد الإلكتروني
    checkEmail = this.asyncWrapper(async (req, res) => {
        const { email } = req.params;
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        res.json({
            available: !existingUser,
            message: existingUser ? 'البريد الإلكتروني موجود مسبقاً' : 'البريد الإلكتروني متاح'
        });
    });
}

module.exports = new AuthController();