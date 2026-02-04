const CaseService = require('../services/CaseService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class CaseController extends BaseController {
    // ✅ إنشاء قضية جديدة
    createCase = this.asyncWrapper(async (req, res) => {
        const result = await CaseService.createCase(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم إنشاء القضية بنجاح');
    });

    // ✅ جلب جميع القضايا
    getAllCases = this.asyncWrapper(async (req, res) => {
        const {
            page = 1,
            limit = 10,
            status,
            case_type,
            lawyer_id,
            search
        } = req.query;

        const officeId = req.session.officeId;
        const userId = req.session.userId;
        const userRole = req.session.userRole;

        const offset = (page - 1) * limit;
        let whereConditions = ['c.office_id = ?'];
        let params = [officeId];

        // الفلاتر
        if (status) {
            whereConditions.push('c.status = ?');
            params.push(status);
        }

        if (case_type) {
            whereConditions.push('c.case_type = ?');
            params.push(case_type);
        }

        if (lawyer_id) {
            whereConditions.push('c.lawyer_id = ?');
            params.push(lawyer_id);
        }

        if (search) {
            whereConditions.push('(c.title LIKE ? OR c.case_number LIKE ? OR cl.full_name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // --- RBAC ---
        const userClientId = req.session.clientId;
        if (userRole === 'client') {
            if (!userClientId) throw new Error('غير مصرح للعميل بالوصول');
            whereConditions.push('c.client_id = ?');
            params.push(userClientId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            whereConditions.push('(c.lawyer_id = ? OR c.assistant_lawyer_id = ?)');
            params.push(userId, userId);
        } else if (userRole === 'trainee') {
            whereConditions.push('c.assistant_lawyer_id = ?');
            params.push(userId);
        }

        const whereClause = whereConditions.join(' AND ');

        const cases = await db.all(`
            SELECT 
                c.*,
                cl.full_name as client_name,
                cl.phone as client_phone,
                u.full_name as lawyer_name,
                a.full_name as assistant_lawyer_name,
                (SELECT COUNT(*) FROM sessions s WHERE s.case_id = c.id) as sessions_count,
                (SELECT COUNT(*) FROM documents d WHERE d.case_id = c.id) as documents_count
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            LEFT JOIN users a ON c.assistant_lawyer_id = a.id
            WHERE ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const totalResult = await db.get(`
            SELECT COUNT(*) as total FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE ${whereClause}
        `, params);

        this.sendSuccess(res, {
            cases,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    });

    // ✅ جلب قضية محددة
    getCaseById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const caseData = await db.get(`
            SELECT 
                c.*,
                cl.full_name as client_name,
                cl.email as client_email,
                cl.phone as client_phone,
                cl.address as client_address,
                cl.national_id as client_national_id,
                u.full_name as lawyer_name,
                u.email as lawyer_email,
                u.phone as lawyer_phone,
                a.full_name as assistant_lawyer_name,
                a.email as assistant_lawyer_email
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            LEFT JOIN users a ON c.assistant_lawyer_id = a.id
            WHERE c.id = ? AND c.office_id = ?
        `, [id, officeId]);

        if (!caseData) throw new Error('القضية غير موجودة');

        // RBAC Check
        const { userRole, userId, clientId } = req.session;
        let hasAccess = userRole === 'admin' ||
            (userRole === 'client' && caseData.client_id === clientId) ||
            ((userRole === 'lawyer' || userRole === 'assistant') && (caseData.lawyer_id === userId || caseData.assistant_lawyer_id === userId));

        if (!hasAccess) throw new Error('غير مصرح لك بالوصول لهذه القضية');

        const [sessions, documents] = await Promise.all([
            db.all('SELECT * FROM sessions WHERE case_id = ? AND office_id = ? ORDER BY session_date DESC', [id, officeId]),
            db.all('SELECT * FROM documents WHERE case_id = ? AND office_id = ? ORDER BY uploaded_at DESC', [id, officeId])
        ]);

        this.sendSuccess(res, { ...caseData, sessions, documents });
    });

    // ✅ تحديث قضية
    updateCase = this.asyncWrapper(async (req, res) => {
        await CaseService.updateCase(req.params.id, req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم تحديث القضية بنجاح');
    });

    // ✅ حذف قضية
    deleteCase = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const existingCase = await db.get('SELECT id, title FROM cases WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingCase) throw new Error('القضية غير موجودة');

        const sessionsCount = await db.get('SELECT COUNT(*) as count FROM sessions WHERE case_id = ? AND office_id = ?', [id, officeId]);
        if (sessionsCount.count > 0) throw new Error('لا يمكن حذف القضية لأنها تحتوي على جلسات مرتبطة');

        await db.run('DELETE FROM cases WHERE id = ? AND office_id = ?', [id, officeId]);

        const ActivityService = require('../services/ActivityService');
        await ActivityService.logActivity({
            userId: req.session.userId,
            actionType: 'delete',
            description: `حذف القضية: ${existingCase.title}`,
            entityType: 'case',
            entityId: id,
            officeId
        });

        this.sendSuccess(res, null, 'تم حذف القضية بنجاح');
    });

    // ✅ إحصائيات القضايا
    getCaseStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const [byStatus, byType, byPriority] = await Promise.all([
            db.all(`SELECT status, COUNT(*) as count FROM cases WHERE office_id = ? GROUP BY status`, [officeId]),
            db.all(`SELECT case_type, COUNT(*) as count FROM cases WHERE office_id = ? GROUP BY case_type ORDER BY count DESC`, [officeId]),
            db.all(`SELECT priority, COUNT(*) as count FROM cases WHERE office_id = ? GROUP BY priority`, [officeId])
        ]);

        this.sendSuccess(res, { byStatus, byType, byPriority });
    });
}

module.exports = new CaseController();