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
            query = 'SELECT id, full_name, username, email, phone, role, specialization, is_active, created_at FROM users WHERE office_id = ? AND role IN ("admin", "lawyer", "trainee")';
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

    // ✅ قائمة مبسّطة بالمتدربين لإسناد القضايا (متاحة لأي مستخدم مسجّل دخول)
    getTrainees = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const trainees = await db.all(
            `SELECT id, full_name FROM users WHERE office_id = ? AND role = 'trainee' AND is_active = 1 ORDER BY full_name`,
            [officeId]
        );
        this.sendSuccess(res, trainees);
    });

    // ✅ إضافة عضو فريق جديد (محامي/متدرب/عميل بوابة) — مسار موحّد
    addMember = this.asyncWrapper(async (req, res) => {
        // المحامي (بخلاف الأدمن) يقدر يضيف متدربين فقط، لا محامين آخرين ولا حسابات بوابة
        if (req.session.userRole === 'lawyer' && req.body.role !== 'trainee') {
            throw new Error('غير مصرح لك بإنشاء هذا النوع من الحسابات');
        }

        const result = await UserService.createUser(req.body, req.session.officeId, req.session.userId);
        this.sendCreated(res, result, 'تم إنشاء الحساب بنجاح');
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
