const SessionService = require('../services/SessionService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class SessionController extends BaseController {
    // ✅ إنشاء جلسة جديدة
    createSession = this.asyncWrapper(async (req, res) => {
        const result = await SessionService.createSession(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم إنشاء الجلسة بنجاح');
    });

    // ✅ جلب جميع الجلسات
    getAllSessions = this.asyncWrapper(async (req, res) => {
        const { page = 1, limit = 10, status, case_id, upcoming } = req.query;
        const officeId = req.session.officeId;
        const offset = (page - 1) * limit;

        let whereConditions = ['s.is_active = 1', 's.office_id = ?'];
        let params = [officeId];

        if (status) {
            whereConditions.push('s.status = ?');
            params.push(status);
        }
        if (case_id) {
            whereConditions.push('s.case_id = ?');
            params.push(case_id);
        }
        if (upcoming === 'true') {
            whereConditions.push('s.session_date > datetime("now")');
            whereConditions.push('s.status = "مجدول"');
        }

        // --- RBAC ---
        const { userRole, userId, clientId } = req.session;
        if (userRole === 'client') {
            if (!clientId) throw new Error('غير مصرح للعميل بالوصول');
            whereConditions.push('c.client_id = ?');
            params.push(clientId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            whereConditions.push('(c.lawyer_id = ? OR c.assistant_lawyer_id = ?)');
            params.push(userId, userId);
        } else if (userRole === 'trainee') {
            whereConditions.push('c.assistant_lawyer_id = ?');
            params.push(userId);
        }

        const whereClause = whereConditions.join(' AND ');

        const sessions = await db.all(`
            SELECT s.*, c.case_number, c.title as case_title, c.case_type, cl.full_name as client_name, u.full_name as created_by_name
            FROM sessions s
            LEFT JOIN cases c ON s.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON s.created_by = u.id
            WHERE ${whereClause}
            ORDER BY s.session_date DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const totalResult = await db.get(`SELECT COUNT(*) as total FROM sessions s LEFT JOIN cases c ON s.case_id = c.id WHERE ${whereClause}`, params);

        this.sendSuccess(res, {
            sessions,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    });

    // ✅ جلب الجلسات القادمة
    getUpcomingSessions = this.asyncWrapper(async (req, res) => {
        const { limit = 5 } = req.query;
        const officeId = req.session.officeId;

        let query = `
            SELECT s.*, c.case_number, c.title as case_title, c.case_type, cl.full_name as client_name, u.full_name as lawyer_name
            FROM sessions s
            LEFT JOIN cases c ON s.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            WHERE s.session_date > datetime("now") AND s.status = 'مجدول' AND s.is_active = 1 AND s.office_id = ?
        `;
        let params = [officeId];

        const { userRole, userId, clientId } = req.session;
        if (userRole === 'client') {
            query += ' AND c.client_id = ?';
            params.push(clientId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            query += ' AND (c.lawyer_id = ? OR c.assistant_lawyer_id = ?)';
            params.push(userId, userId);
        }

        query += ' ORDER BY s.session_date ASC LIMIT ?';
        params.push(parseInt(limit));

        const sessions = await db.all(query, params);
        this.sendSuccess(res, sessions);
    });

    // ✅ جلب جلسة محددة
    getSessionById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const session = await db.get(`
            SELECT s.*, c.case_number, c.title as case_title, c.case_type, c.client_id, c.lawyer_id, c.assistant_lawyer_id,
                   cl.full_name as client_name, cl.phone as client_phone, u.full_name as lawyer_name, u.phone as lawyer_phone
            FROM sessions s
            LEFT JOIN cases c ON s.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            WHERE s.id = ? AND s.office_id = ? AND s.is_active = 1
        `, [id, officeId]);

        if (!session) throw new Error('الجلسة غير موجودة');

        const { userRole, userId, clientId } = req.session;
        let hasAccess = userRole === 'admin' || (userRole === 'client' && session.client_id === clientId) ||
            ((userRole === 'lawyer' || userRole === 'assistant') && (session.lawyer_id === userId || session.assistant_lawyer_id === userId)) ||
            (userRole === 'trainee' && session.assistant_lawyer_id === userId);

        if (!hasAccess) throw new Error('غير مصرح لك بالوصول لهذه الجلسة');

        const documents = await db.all('SELECT * FROM documents WHERE session_id = ? AND office_id = ? ORDER BY uploaded_at DESC', [id, officeId]);
        this.sendSuccess(res, { ...session, documents });
    });

    // ✅ تحديث جلسة
    updateSession = this.asyncWrapper(async (req, res) => {
        await SessionService.updateSession(req.params.id, req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم تحديث الجلسة بنجاح');
    });

    // ✅ حذف جلسة
    deleteSession = this.asyncWrapper(async (req, res) => {
        await SessionService.deleteSession(req.params.id, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم حذف الجلسة بنجاح');
    });

    // ✅ إحصائيات الجلسات
    getSessionStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const [byStatus, byType, monthly] = await Promise.all([
            db.all(`SELECT status, COUNT(*) as count FROM sessions WHERE is_active = 1 AND office_id = ? GROUP BY status`, [officeId]),
            db.all(`SELECT session_type, COUNT(*) as count FROM sessions WHERE is_active = 1 AND office_id = ? GROUP BY session_type ORDER BY count DESC`, [officeId]),
            db.all(`SELECT strftime('%Y-%m', session_date) as month, COUNT(*) as count FROM sessions WHERE session_date >= datetime('now', '-6 months') AND is_active = 1 AND office_id = ? GROUP BY month ORDER BY month`, [officeId])
        ]);

        this.sendSuccess(res, { byStatus, byType, monthly });
    });
}

module.exports = new SessionController();