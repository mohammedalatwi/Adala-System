const UserService = require('../services/UserService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class UserController extends BaseController {
    // ✅ جلب جميع المستخدمين
    getAllUsers = this.asyncWrapper(async (req, res) => {
        const { page = 1, limit = 10, role, search } = req.query;
        const officeId = req.session.officeId;
        const offset = (page - 1) * limit;

        let whereConditions = ['u.is_active = 1', 'u.office_id = ?'];
        let params = [officeId];

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
        `, [...params, parseInt(limit), parseInt(offset)]);

        const totalResult = await db.get(`SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`, params);

        this.sendSuccess(res, {
            users,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    });

    // ✅ جلب مستخدم محدد
    getUserById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const user = await db.get(`
            SELECT id, full_name, username, email, phone, role, specialization, license_number, experience_years, bio, avatar_url, is_active, last_login, created_at
            FROM users 
            WHERE id = ? AND office_id = ? AND is_active = 1
        `, [id, officeId]);

        if (!user) throw new Error('المستخدم غير موجود');

        const stats = await db.get(`
            SELECT 
                (SELECT COUNT(*) FROM cases WHERE lawyer_id = ?) as total_cases,
                (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'منتهي') as completed_cases,
                (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status IN ('جديد', 'قيد الدراسة', 'قيد التنفيذ')) as active_cases,
                (SELECT COUNT(*) FROM clients WHERE created_by = ?) as total_clients
        `, [id, id, id, id]);

        this.sendSuccess(res, { ...user, stats });
    });

    // ✅ إنشاء مستخدم جديد
    createUser = this.asyncWrapper(async (req, res) => {
        const result = await UserService.createUser(req.body, req.session.officeId, req.session.userId);
        this.sendCreated(res, result, 'تم إنشاء المستخدم بنجاح');
    });

    // ✅ تحديث مستخدم
    updateUser = this.asyncWrapper(async (req, res) => {
        await UserService.updateUser(req.params.id, req.body, req.session.officeId, req.session.userId);
        this.sendSuccess(res, null, 'تم تحديث المستخدم بنجاح');
    });

    // ✅ حذف مستخدم
    deleteUser = this.asyncWrapper(async (req, res) => {
        await UserService.deleteUser(req.params.id, req.session.officeId, req.session.userId);
        this.sendSuccess(res, null, 'تم حذف المستخدم بنجاح');
    });

    // ✅ تحديث حالة المستخدم
    updateUserStatus = this.asyncWrapper(async (req, res) => {
        await UserService.updateUserStatus(req.params.id, req.body.is_active, req.session.officeId, req.session.userId);
        const action = req.body.is_active ? 'تفعيل' : 'تعطيل';
        this.sendSuccess(res, null, `تم ${action} المستخدم بنجاح`);
    });

    // ✅ إحصائيات المستخدمين
    getUserStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const byRole = await db.all('SELECT role, COUNT(*) as count, COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count, COUNT(CASE WHEN last_login > datetime("now", "-7 days") THEN 1 END) as recent_login_count FROM users WHERE office_id = ? GROUP BY role', [officeId]);
        const byExperience = await db.all(`
            SELECT 
                CASE 
                    WHEN experience_years <= 2 THEN 'مبتدئ (0-2)'
                    WHEN experience_years <= 5 THEN 'متوسط (3-5)'
                    WHEN experience_years <= 10 THEN 'خبير (6-10)'
                    ELSE 'خبير جداً (+10)'
                END as experience_level,
                COUNT(*) as count
            FROM users 
            WHERE role = 'lawyer' AND office_id = ?
            GROUP BY experience_level
            ORDER BY experience_years
        `, [officeId]);

        this.sendSuccess(res, { byRole, byExperience });
    });
}

module.exports = new UserController();