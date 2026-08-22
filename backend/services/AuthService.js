const db = require('../db/database');
const bcrypt = require('bcryptjs');
const ActivityService = require('./ActivityService');

class AuthService {
    constructor() {
        this.db = db;
    }

    /**
     * Register a new user and create an office for them.
     */
    async register(userData) {
        const { full_name, username, email, password, phone, specialization } = userData;

        // Hashing outside the transaction: bcrypt is CPU-bound and doesn't touch the
        // database, so there's no reason to hold the transaction queue's turn for it.
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        return this.db.transaction(async () => {
            // 1. Create Office
            const officeResult = await this.db.run(
                'INSERT INTO offices (name, email, phone) VALUES (?, ?, ?)',
                [`مكتب ${full_name}`, email, phone]
            );
            const officeId = officeResult.id;

            // 2. Create User as Admin of the new office
            const userResult = await this.db.run(
                `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, 'admin', specialization, officeId]
            );

            return {
                userId: userResult.id,
                officeId: officeId
            };
        });
    }

    /**
     * Authenticate a user.
     */
    async login(identifier, password) {
        const user = await this.db.get(
            'SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = 1',
            [identifier, identifier]
        );

        if (!user) {
            throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        }

        // Update last login
        await this.db.run(
            'UPDATE users SET last_login = datetime("now") WHERE id = ?',
            [user.id]
        );

        // Log activity
        await ActivityService.logActivity({
            userId: user.id,
            actionType: 'login',
            description: 'تسجيل الدخول إلى النظام',
            entityType: 'system',
            officeId: user.office_id
        });

        return user;
    }

    /**
     * Change a logged-in user's own password after verifying their current one.
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId]);
        if (!user) {
            throw new Error('المستخدم غير موجود');
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            const error = new Error('كلمة المرور الحالية غير صحيحة');
            error.statusCode = 401;
            throw error;
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        await this.db.run(
            'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime("now") WHERE id = ?',
            [passwordHash, user.id]
        );

        await ActivityService.logActivity({
            userId: user.id,
            actionType: 'update',
            entityType: 'user',
            entityId: user.id,
            description: 'تغيير كلمة المرور',
            officeId: user.office_id
        });
    }
}

module.exports = new AuthService();
