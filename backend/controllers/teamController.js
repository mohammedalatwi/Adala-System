const UserService = require('../services/UserService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class TeamController extends BaseController {
    // ✅ الحصول على أعضاء الفريق (للمحامي)
    getMyTeam = this.asyncWrapper(async (req, res) => {
        const { userId: lawyerId, userRole: role, officeId } = req.session;

        let query = '';
        let params = [];

        if (role === 'admin') {
            // المدير يرى الجميع في مكتبه
            query = 'SELECT id, full_name, username, email, phone, role, specialization, is_active, created_at FROM users WHERE office_id = ? AND role IN ("admin", "lawyer", "assistant", "trainee")';
            params = [officeId];
        } else {
            // المحامي يرى المتدربين التابعين له في مكتبه
            query = 'SELECT id, full_name, username, email, phone, role, specialization, is_active, created_at FROM users WHERE office_id = ? AND supervisor_id = ?';
            params = [officeId, lawyerId];
        }

        const team = await db.all(query, params);
        this.sendSuccess(res, team);
    });

    // ✅ قائمة مبسّطة بالمحامين لإسناد القضايا (متاحة لأي مستخدم مسجّل دخول)
    getLawyers = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const lawyers = await db.all(
            `SELECT id, full_name FROM users WHERE office_id = ? AND role = 'lawyer' AND is_active = 1 ORDER BY full_name`,
            [officeId]
        );
        this.sendSuccess(res, lawyers);
    });

    // ✅ إضافة متدرب جديد
    addTrainee = this.asyncWrapper(async (req, res) => {
        const { full_name, username, email, password, phone, specialization } = req.body;
        const supervisorId = req.session.userId;
        const officeId = req.session.officeId;

        // Reuse logic from UserService if compatible, but TeamController has specific supervisor_id
        // For now, let's keep it here but using asyncWrapper
        // استثناء مقصود: لا يوجد عزل office_id هنا لأن username/email فريدان على مستوى النظام كله
        const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existing) throw new Error('اسم المستخدم أو البريد الإلكتروني موجود مسبقاً');

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);

        await db.run(
            `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, supervisor_id, office_id)
             VALUES (?, ?, ?, ?, ?, 'trainee', ?, ?, ?)`,
            [full_name, username, email, passwordHash, phone, specialization, supervisorId, officeId]
        );

        this.sendCreated(res, null, 'تم إضافة المتدرب بنجاح');
    });

    // ✅ حذف عضو من الفريق
    removeMember = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const { userId: currentUserId, userRole: role, officeId } = req.session;

        if (role !== 'admin') {
            const member = await db.get('SELECT id FROM users WHERE id = ? AND supervisor_id = ? AND office_id = ?', [id, currentUserId, officeId]);
            if (!member) return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف هذا العضو' });
        } else {
            const member = await db.get('SELECT id FROM users WHERE id = ? AND office_id = ?', [id, officeId]);
            if (!member) return res.status(403).json({ success: false, message: 'العضو غير موجود في مكتبك' });
        }

        await UserService.deleteUser(id, officeId, currentUserId);
        this.sendSuccess(res, null, 'تم تعطيل حساب العضو بنجاح');
    });
}

module.exports = new TeamController();
