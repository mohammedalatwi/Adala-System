const bcrypt = require('bcryptjs');
const db = require('../db/database');
const config = require('../config/config');

class User {
    constructor() {
        this.db = db;
    }

    // ✅ إنشاء مستخدم جديد
    async create(userData) {
        const {
            full_name,
            username,
            email,
            password,
            phone,
            role = 'lawyer',
            specialization,
            license_number,
            experience_years = 0,
            bio
        } = userData;

        try {
            // التحقق من البيانات
            if (!full_name || !username || !email || !password) {
                return { success: false, message: 'جميع الحقول الإلزامية مطلوبة' };
            }

            if (password.length < 6) {
                return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
            }

            // التحقق من توفر اسم المستخدم والبريد الإلكتروني
            const existingUser = await this.findByUsername(username);
            if (existingUser) {
                return { success: false, message: 'اسم المستخدم موجود مسبقاً' };
            }

            const existingEmail = await this.findByEmail(email);
            if (existingEmail) {
                return { success: false, message: 'البريد الإلكتروني موجود مسبقاً' };
            }

            // تشفير كلمة المرور
            const passwordHash = await bcrypt.hash(password, config.encryption.saltRounds);

            const result = await this.db.run(
                `INSERT INTO users 
                 (full_name, username, email, password_hash, phone, role, specialization, license_number, experience_years, bio) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, role, specialization, license_number, experience_years, bio]
            );

            return {
                success: true,
                user: {
                    id: result.id,
                    full_name,
                    username,
                    email,
                    role,
                    specialization
                }
            };
        } catch (error) {
            console.error('Error creating user:', error);

            if (error.code === 'SQLITE_CONSTRAINT') {
                if (error.message.includes('username')) {
                    return { success: false, message: 'اسم المستخدم موجود مسبقاً' };
                }
                if (error.message.includes('email')) {
                    return { success: false, message: 'البريد الإلكتروني موجود مسبقاً' };
                }
            }

            return { success: false, message: 'فشل في إنشاء المستخدم' };
        }
    }

    // ✅ البحث عن مستخدم بالبريد الإلكتروني
    async findByEmail(email) {
        try {
            const user = await this.db.get(
                `SELECT * FROM users WHERE email = ? AND is_active = 1`,
                [email]
            );
            return user;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    // ✅ البحث عن مستخدم باسم المستخدم
    async findByUsername(username) {
        try {
            const user = await this.db.get(
                `SELECT * FROM users WHERE username = ? AND is_active = 1`,
                [username]
            );
            return user;
        } catch (error) {
            console.error('Error finding user by username:', error);
            throw error;
        }
    }

    // ✅ البحث عن مستخدم بالمعرف
    async findById(id) {
        try {
            const user = await this.db.get(
                `SELECT id, full_name, username, email, phone, role, specialization, 
                        license_number, experience_years, bio, avatar_url, is_active, 
                        last_login, created_at 
                 FROM users WHERE id = ? AND is_active = 1`,
                [id]
            );
            return user;
        } catch (error) {
            console.error('Error finding user by id:', error);
            throw error;
        }
    }

    // ✅ التحقق من كلمة المرور
    async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // ✅ تحديث آخر تسجيل دخول
    async updateLastLogin(userId) {
        try {
            await this.db.run(
                `UPDATE users SET last_login = datetime('now') WHERE id = ?`,
                [userId]
            );
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    // ✅ جلب جميع المستخدمين
    async getAll(limit = 50, offset = 0, filters = {}) {
        try {
            let whereConditions = ['is_active = 1'];
            let params = [];

            if (filters.role) {
                whereConditions.push('role = ?');
                params.push(filters.role);
            }

            if (filters.search) {
                whereConditions.push('(full_name LIKE ? OR username LIKE ? OR email LIKE ?)');
                params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
            }

            const whereClause = whereConditions.join(' AND ');

            const users = await this.db.all(
                `SELECT id, full_name, username, email, phone, role, specialization, 
                        license_number, experience_years, is_active, last_login, created_at
                 FROM users 
                 WHERE ${whereClause}
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            const total = await this.db.get(
                `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`,
                params
            );

            return {
                success: true,
                data: users,
                pagination: {
                    total: total.count,
                    limit,
                    offset
                }
            };
        } catch (error) {
            console.error('Error getting all users:', error);
            return { success: false, message: 'فشل في جلب المستخدمين' };
        }
    }

    // ✅ تحديث بيانات المستخدم
    async update(userId, updateData) {
        try {
            const allowedFields = [
                'full_name', 'phone', 'specialization', 'license_number',
                'experience_years', 'bio', 'avatar_url'
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
                return { success: false, message: 'لا توجد بيانات لتحديثها' };
            }

            updates.push('updated_at = datetime("now")');
            values.push(userId);

            await this.db.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return { success: true, message: 'تم تحديث البيانات بنجاح' };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, message: 'فشل في تحديث البيانات' };
        }
    }

    // ✅ تغيير كلمة المرور
    async changePassword(userId, currentPassword, newPassword) {
        try {
            if (newPassword.length < 6) {
                return { success: false, message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' };
            }

            // جلب المستخدم والتحقق من كلمة المرور الحالية
            const user = await this.findById(userId);
            if (!user) {
                return { success: false, message: 'المستخدم غير موجود' };
            }

            const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                return { success: false, message: 'كلمة المرور الحالية غير صحيحة' };
            }

            // تشفير كلمة المرور الجديدة
            const newPasswordHash = await bcrypt.hash(newPassword, config.encryption.saltRounds);

            await this.db.run(
                'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?',
                [newPasswordHash, userId]
            );

            return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
        } catch (error) {
            console.error('Error changing password:', error);
            return { success: false, message: 'فشل في تغيير كلمة المرور' };
        }
    }

    // ✅ تعطيل المستخدم
    async deactivate(userId) {
        try {
            await this.db.run(
                `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`,
                [userId]
            );

            return { success: true, message: 'تم تعطيل المستخدم بنجاح' };
        } catch (error) {
            console.error('Error deactivating user:', error);
            return { success: false, message: 'فشل في تعطيل المستخدم' };
        }
    }

    // ✅ جلب إحصائيات المستخدم
    async getUserStats(userId) {
        try {
            const stats = await this.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ?) as total_cases,
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'منتهي') as completed_cases,
                    (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status IN ('جديد', 'قيد الدراسة', 'قيد التنفيذ')) as active_cases,
                    (SELECT COUNT(*) FROM sessions WHERE created_by = ?) as total_sessions,
                    (SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status != 'مكتمل') as pending_tasks,
                    (SELECT COUNT(*) FROM documents WHERE uploaded_by = ?) as total_documents
            `, [userId, userId, userId, userId, userId, userId]);

            return { success: true, data: stats };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return { success: false, message: 'فشل في جلب الإحصائيات' };
        }
    }

    // ✅ البحث عن المحامين
    async getLawyers() {
        try {
            const lawyers = await this.db.all(`
                SELECT id, full_name, specialization, experience_years, license_number
                FROM users 
                WHERE role IN ('lawyer', 'admin') AND is_active = 1
                ORDER BY full_name
            `);

            return { success: true, data: lawyers };
        } catch (error) {
            console.error('Error getting lawyers:', error);
            return { success: false, message: 'فشل في جلب قائمة المحامين' };
        }
    }
}

module.exports = User;