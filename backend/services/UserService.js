const db = require('../db/database');
const bcrypt = require('bcryptjs');
const ActivityService = require('./ActivityService');

class UserService {
    constructor() {
        this.db = db;
    }

    async createUser(userData, officeId, currentUserId) {
        const { full_name, username, email, password, phone, role, specialization, license_number } = userData;

        const existingUser = await this.db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUser) throw new Error('البريد الإلكتروني أو اسم المستخدم موجود مسبقاً');

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const result = await this.db.run(
            `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, license_number, office_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [full_name, username, email, passwordHash, phone, role, specialization, license_number, officeId]
        );

        await ActivityService.logActivity({
            userId: currentUserId,
            actionType: 'create',
            entityType: 'user',
            entityId: result.id,
            description: `إنشاء مستخدم جديد: ${full_name}`,
            officeId
        });

        return { id: result.id, full_name, email };
    }

    async updateUser(id, updateData, officeId, currentUserId) {
        const existingUser = await this.db.get('SELECT id, full_name FROM users WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingUser) throw new Error('المستخدم غير موجود');

        const allowedFields = ['full_name', 'username', 'email', 'phone', 'specialization', 'license_number', 'experience_years', 'bio', 'avatar_url'];
        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updates.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updates.push('updated_at = datetime("now")');
        values.push(id, officeId);

        await this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`, values);

        await ActivityService.logActivity({
            userId: currentUserId,
            actionType: 'update',
            entityType: 'user',
            entityId: id,
            description: `تحديث بيانات المستخدم: ${existingUser.full_name}`,
            officeId
        });

        return true;
    }

    async deleteUser(id, officeId, currentUserId) {
        if (parseInt(id) === currentUserId) throw new Error('لا يمكن حذف حسابك الشخصي');

        const existingUser = await this.db.get('SELECT id, full_name FROM users WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingUser) throw new Error('المستخدم غير موجود');

        const casesCount = await this.db.get('SELECT COUNT(*) as count FROM cases WHERE lawyer_id = ? AND office_id = ?', [id, officeId]);
        if (casesCount.count > 0) throw new Error('لا يمكن حذف المستخدم لأنه مرتبط بقضايا');

        await this.db.run('UPDATE users SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND office_id = ?', [id, officeId]);

        await ActivityService.logActivity({
            userId: currentUserId,
            actionType: 'delete',
            entityType: 'user',
            entityId: id,
            description: `حذف المستخدم: ${existingUser.full_name}`,
            officeId
        });

        return true;
    }

    async updateUserStatus(id, is_active, officeId, currentUserId) {
        const existingUser = await this.db.get('SELECT id, full_name FROM users WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingUser) throw new Error('المستخدم غير موجود');

        await this.db.run('UPDATE users SET is_active = ?, updated_at = datetime("now") WHERE id = ? AND office_id = ?', [is_active ? 1 : 0, id, officeId]);

        const action = is_active ? 'تفعيل' : 'تعطيل';
        await ActivityService.logActivity({
            userId: currentUserId,
            actionType: 'update',
            entityType: 'user',
            entityId: id,
            description: `${action} المستخدم: ${existingUser.full_name}`,
            officeId
        });

        return true;
    }
}

module.exports = new UserService();
