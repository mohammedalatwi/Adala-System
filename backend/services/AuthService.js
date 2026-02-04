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

        // Start transaction
        await this.db.run('BEGIN TRANSACTION');

        try {
            // 1. Create Office
            const officeResult = await this.db.run(
                'INSERT INTO offices (name, email, phone) VALUES (?, ?, ?)',
                [`مكتب ${full_name}`, email, phone]
            );
            const officeId = officeResult.id;

            // 2. Hash Password
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // 3. Create User as Admin of the new office
            const userResult = await this.db.run(
                `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, 'admin', specialization, officeId]
            );

            await this.db.run('COMMIT');

            return {
                userId: userResult.id,
                officeId: officeId
            };
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
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
}

module.exports = new AuthService();
