const Database = require('../db/database');
const bcrypt = require('bcryptjs');
const db = new Database();

class AuthController {
    // ✅ تسجيل مستخدم جديد
    register = async (req, res) => {
        try {
            const { full_name, username, email, password, phone, role, specialization } = req.body;

            // التحقق من عدم وجود مستخدم بنفس البريد أو اسم المستخدم
            const existingUser = await db.get(
                'SELECT id FROM users WHERE email = ? OR username = ?',
                [email, username]
            );

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني أو اسم المستخدم موجود مسبقاً'
                });
            }

            // تشفير كلمة المرور
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // إضافة المستخدم
            const result = await db.run(
                `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, role || 'lawyer', specialization]
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء الحساب بنجاح',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء الحساب'
            });
        }
    };

    // ✅ تسجيل الدخول
    login = async (req, res) => {
        try {
            const { email, password } = req.body;

            // البحث عن المستخدم
            const user = await db.get(
                'SELECT * FROM users WHERE email = ? AND is_active = 1',
                [email]
            );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                });
            }

            // التحقق من كلمة المرور
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                });
            }

            // إنشاء الجلسة
            req.session.userId = user.id;
            req.session.userRole = user.role;
            
            // تحديث آخر دخول
            await db.run(
                'UPDATE users SET last_login = datetime("now") WHERE id = ?',
                [user.id]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, description) VALUES (?, ?, ?)',
                [user.id, 'login', 'تسجيل الدخول إلى النظام']
            );

            res.json({
                success: true,
                message: 'تم تسجيل الدخول بنجاح',
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    specialization: user.specialization
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تسجيل الدخول'
            });
        }
    };

    // ✅ تسجيل الخروج
    logout = async (req, res) => {
        try {
            // تسجيل النشاط قبل تدمير الجلسة
            if (req.session.userId) {
                await db.run(
                    'INSERT INTO activities (user_id, action_type, description) VALUES (?, ?, ?)',
                    [req.session.userId, 'logout', 'تسجيل الخروج من النظام']
                );
            }

            req.session.destroy((err) => {
                if (err) {
                    throw new Error('فشل في تدمير الجلسة');
                }
                res.json({ success: true, message: 'تم تسجيل الخروج' });
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'فشل في تسجيل الخروج'
            });
        }
    };

    // ✅ الحصول على حالة المصادقة
    getAuthStatus = async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.json({
                    authenticated: false,
                    user: null
                });
            }

            const user = await db.get(
                `SELECT id, full_name, username, email, role, specialization, 
                        avatar_url, created_at 
                 FROM users 
                 WHERE id = ? AND is_active = 1`,
                [req.session.userId]
            );

            if (!user) {
                req.session.destroy();
                return res.json({
                    authenticated: false,
                    user: null
                });
            }

            res.json({
                authenticated: true,
                user: user
            });

        } catch (error) {
            console.error('Auth status error:', error);
            res.json({
                authenticated: false,
                user: null
            });
        }
    };

    // ✅ التحقق من اسم المستخدم
    checkUsername = async (req, res) => {
        try {
            const { username } = req.params;

            const existingUser = await db.get(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );

            res.json({
                available: !existingUser,
                message: existingUser ? 'اسم المستخدم موجود مسبقاً' : 'اسم المستخدم متاح'
            });

        } catch (error) {
            console.error('Username check error:', error);
            res.status(500).json({
                available: false,
                message: 'فشل في التحقق من اسم المستخدم'
            });
        }
    };

    // ✅ التحقق من البريد الإلكتروني
    checkEmail = async (req, res) => {
        try {
            const { email } = req.params;

            const existingUser = await db.get(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );

            res.json({
                available: !existingUser,
                message: existingUser ? 'البريد الإلكتروني موجود مسبقاً' : 'البريد الإلكتروني متاح'
            });

        } catch (error) {
            console.error('Email check error:', error);
            res.status(500).json({
                available: false,
                message: 'فشل في التحقق من البريد الإلكتروني'
            });
        }
    };
}

module.exports = new AuthController();