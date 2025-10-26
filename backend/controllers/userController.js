const Database = require('../db/database');
const bcrypt = require('bcryptjs');
const db = new Database();

class UserController {
    // ✅ جلب جميع المستخدمين
    getAllUsers = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                role,
                search
            } = req.query;

            const offset = (page - 1) * limit;
            let whereConditions = ['u.is_active = 1'];
            let params = [];

            if (role) {
                whereConditions.push('u.role = ?');
                params.push(role);
            }

            if (search) {
                whereConditions.push('(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const whereClause = whereConditions.join(' AND ');

            const users = await db.all(`
                SELECT 
                    u.id, u.full_name, u.username, u.email, u.phone, u.role,
                    u.specialization, u.license_number, u.experience_years,
                    u.avatar_url, u.is_active, u.last_login, u.created_at,
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = u.id) as cases_count,
                    (SELECT COUNT(*) FROM clients WHERE created_by = u.id) as clients_count
                FROM users u
                WHERE ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM users u
                WHERE ${whereClause}
            `, params);

            res.json({
                success: true,
                data: users,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المستخدمين'
            });
        }
    };

    // ✅ جلب مستخدم محدد
    getUserById = async (req, res) => {
        try {
            const { id } = req.params;

            const user = await db.get(`
                SELECT 
                    id, full_name, username, email, phone, role,
                    specialization, license_number, experience_years,
                    bio, avatar_url, is_active, last_login, created_at
                FROM users 
                WHERE id = ? AND is_active = 1
            `, [id]);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            // جلب إحصائيات المستخدم
            const stats = await db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ?) as total_cases,
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'منتهي') as completed_cases,
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status IN ('جديد', 'قيد الدراسة', 'قيد التنفيذ')) as active_cases,
                    (SELECT COUNT(*) FROM clients WHERE created_by = ?) as total_clients
            `, [id, id, id, id]);

            res.json({
                success: true,
                data: {
                    ...user,
                    stats
                }
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المستخدم'
            });
        }
    };

    // ✅ إنشاء مستخدم جديد
    createUser = async (req, res) => {
        try {
            const { full_name, username, email, password, phone, role, specialization, license_number } = req.body;

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

            const result = await db.run(
                `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, license_number)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, role, specialization, license_number]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'create', 'user', result.id, `إنشاء مستخدم جديد: ${full_name}`]
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء المستخدم بنجاح',
                data: { id: result.id, full_name, email }
            });

        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء المستخدم'
            });
        }
    };

    // ✅ تحديث مستخدم
    updateUser = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // التحقق من وجود المستخدم
            const existingUser = await db.get(
                'SELECT id, full_name FROM users WHERE id = ?',
                [id]
            );

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            const allowedFields = [
                'full_name', 'username', 'email', 'phone', 'specialization',
                'license_number', 'experience_years', 'bio', 'avatar_url'
            ];

            const updates = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key) && updateData[key] !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا توجد بيانات لتحديثها'
                });
            }

            updates.push('updated_at = datetime("now")');
            values.push(id);

            await db.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'update', 'user', id, `تحديث بيانات المستخدم: ${existingUser.full_name}`]
            );

            res.json({
                success: true,
                message: 'تم تحديث المستخدم بنجاح'
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث المستخدم'
            });
        }
    };

    // ✅ حذف مستخدم
    deleteUser = async (req, res) => {
        try {
            const { id } = req.params;

            // منع حذف المستخدم الحالي
            if (parseInt(id) === req.session.userId) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن حذف حسابك الشخصي'
                });
            }

            const existingUser = await db.get(
                'SELECT id, full_name FROM users WHERE id = ?',
                [id]
            );

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            // التحقق من عدم وجود قضايا مرتبطة
            const casesCount = await db.get(
                'SELECT COUNT(*) as count FROM cases WHERE lawyer_id = ?',
                [id]
            );

            if (casesCount.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن حذف المستخدم لأنه مرتبط بقضايا'
                });
            }

            await db.run(
                'UPDATE users SET is_active = 0, updated_at = datetime("now") WHERE id = ?',
                [id]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'delete', 'user', id, `حذف المستخدم: ${existingUser.full_name}`]
            );

            res.json({
                success: true,
                message: 'تم حذف المستخدم بنجاح'
            });

        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف المستخدم'
            });
        }
    };

    // ✅ تحديث حالة المستخدم
    updateUserStatus = async (req, res) => {
        try {
            const { id } = req.params;
            const { is_active } = req.body;

            const existingUser = await db.get(
                'SELECT id, full_name FROM users WHERE id = ?',
                [id]
            );

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            await db.run(
                'UPDATE users SET is_active = ?, updated_at = datetime("now") WHERE id = ?',
                [is_active ? 1 : 0, id]
            );

            const action = is_active ? 'تفعيل' : 'تعطيل';
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'update', 'user', id, `${action} المستخدم: ${existingUser.full_name}`]
            );

            res.json({
                success: true,
                message: `تم ${action} المستخدم بنجاح`
            });

        } catch (error) {
            console.error('Update user status error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث حالة المستخدم'
            });
        }
    };

    // ✅ إحصائيات المستخدمين
    getUserStats = async (req, res) => {
        try {
            const stats = await db.all(`
                SELECT 
                    role,
                    COUNT(*) as count,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count,
                    COUNT(CASE WHEN last_login > datetime('now', '-7 days') THEN 1 END) as recent_login_count
                FROM users 
                GROUP BY role
            `);

            const experienceStats = await db.all(`
                SELECT 
                    CASE 
                        WHEN experience_years <= 2 THEN 'مبتدئ (0-2)'
                        WHEN experience_years <= 5 THEN 'متوسط (3-5)'
                        WHEN experience_years <= 10 THEN 'خبير (6-10)'
                        ELSE 'خبير جداً (+10)'
                    END as experience_level,
                    COUNT(*) as count
                FROM users 
                WHERE role = 'lawyer'
                GROUP BY experience_level
                ORDER BY experience_years
            `);

            res.json({
                success: true,
                data: {
                    byRole: stats,
                    byExperience: experienceStats
                }
            });

        } catch (error) {
            console.error('User stats error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات المستخدمين'
            });
        }
    };
}

module.exports = new UserController();