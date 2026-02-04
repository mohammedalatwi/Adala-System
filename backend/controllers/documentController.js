const DocumentService = require('../services/DocumentService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');
const fs = require('fs');

class DocumentController extends BaseController {
    // ✅ إنشاء مستند جديد
    createDocument = this.asyncWrapper(async (req, res) => {
        const result = await DocumentService.createDocument(req.body, req.file, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم رفع المستند بنجاح');
    });

    // ✅ جلب جميع المستندات
    getAllDocuments = this.asyncWrapper(async (req, res) => {
        const { page = 1, limit = 10, document_type, case_id, session_id, search } = req.query;
        const officeId = req.session.officeId;
        const offset = (page - 1) * limit;

        let whereConditions = ['d.office_id = ?'];
        let params = [officeId];

        if (document_type) {
            whereConditions.push('d.document_type = ?');
            params.push(document_type);
        }
        if (case_id) {
            whereConditions.push('d.case_id = ?');
            params.push(case_id);
        }
        if (session_id) {
            whereConditions.push('d.session_id = ?');
            params.push(session_id);
        }
        if (search) {
            whereConditions.push('(d.title LIKE ? OR d.description LIKE ? OR d.file_name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // --- RBAC ---
        const { userRole, userId, clientId: userClientId } = req.session;
        if (userRole === 'client') {
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

        const documents = await db.all(`
            SELECT d.*, c.case_number, c.title as case_title, s.session_number, u.full_name as uploaded_by_name
            FROM documents d
            LEFT JOIN cases c ON d.case_id = c.id
            LEFT JOIN sessions s ON d.session_id = s.id
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE ${whereClause} AND d.is_active = 1
            ORDER BY d.uploaded_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const totalResult = await db.get(`SELECT COUNT(*) as total FROM documents d LEFT JOIN cases c ON d.case_id = c.id WHERE ${whereClause} AND d.is_active = 1`, params);

        this.sendSuccess(res, {
            documents,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    });

    // ✅ جلب مستند محدد
    getDocumentById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const document = await db.get(`
            SELECT d.*, c.case_number, c.title as case_title, s.session_number, s.session_date, u.full_name as uploaded_by_name, u.email as uploaded_by_email
            FROM documents d
            LEFT JOIN cases c ON d.case_id = c.id
            LEFT JOIN sessions s ON d.session_id = s.id
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.id = ? AND d.office_id = ? AND d.is_active = 1
        `, [id, officeId]);

        if (!document) throw new Error('المستند غير موجود');

        // RBAC check
        const { userRole, userId, clientId: userClientId } = req.session;
        let hasAccess = userRole === 'admin';

        if (!hasAccess) {
            const caseObj = await db.get('SELECT client_id, lawyer_id, assistant_lawyer_id FROM cases WHERE id = ?', [document.case_id]);
            if (caseObj) {
                if (userRole === 'client' && caseObj.client_id === userClientId) hasAccess = true;
                else if ((userRole === 'lawyer' || userRole === 'assistant') && (caseObj.lawyer_id === userId || caseObj.assistant_lawyer_id === userId)) hasAccess = true;
            }
        }

        if (!hasAccess) return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول لهذا المستند' });

        this.sendSuccess(res, document);
    });

    // ✅ تحديث مستند
    updateDocument = this.asyncWrapper(async (req, res) => {
        await DocumentService.updateDocument(req.params.id, req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم تحديث المستند بنجاح');
    });

    // ✅ حذف مستند
    deleteDocument = this.asyncWrapper(async (req, res) => {
        await DocumentService.deleteDocument(req.params.id, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم حذف المستند بنجاح');
    });

    // ✅ تحميل المستند
    downloadDocument = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const document = await db.get('SELECT id, file_name, file_path, case_id FROM documents WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!document) throw new Error('المستند غير موجود');

        // RBAC check
        const { userRole, userId, clientId: userClientId } = req.session;
        let hasAccess = userRole === 'admin';
        if (!hasAccess) {
            const caseObj = await db.get('SELECT client_id, lawyer_id, assistant_lawyer_id FROM cases WHERE id = ?', [document.case_id]);
            if (caseObj) {
                if (userRole === 'client' && caseObj.client_id === userClientId) hasAccess = true;
                else if ((userRole === 'lawyer' || userRole === 'assistant') && (caseObj.lawyer_id === userId || caseObj.assistant_lawyer_id === userId)) hasAccess = true;
            }
        }
        if (!hasAccess) return res.status(403).json({ success: false, message: 'غير مصرح لك بتحميل هذا المستند' });

        if (!document.file_path || !fs.existsSync(document.file_path)) throw new Error('الملف غير موجود على الخادم');

        await db.run('INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
            [userId, 'download', 'document', id, `تحميل المستند: ${document.file_name}`]);

        res.download(document.file_path, document.file_name);
    });

    // ✅ إحصائيات المستندات
    getDocumentStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const byType = await db.all('SELECT document_type, COUNT(*) as count, SUM(file_size) as total_size FROM documents WHERE office_id = ? GROUP BY document_type ORDER BY count DESC', [officeId]);
        const monthly = await db.all('SELECT strftime("%Y-%m", uploaded_at) as month, COUNT(*) as count, SUM(file_size) as total_size FROM documents WHERE uploaded_at >= datetime("now", "-6 months") AND office_id = ? GROUP BY month ORDER BY month', [officeId]);
        const byCase = await db.all(`
            SELECT c.case_number, c.title as case_title, COUNT(d.id) as documents_count, SUM(d.file_size) as total_size
            FROM cases c
            LEFT JOIN documents d ON c.id = d.case_id
            WHERE c.office_id = ?
            GROUP BY c.id
            HAVING documents_count > 0
            ORDER BY documents_count DESC
            LIMIT 10
        `, [officeId]);

        this.sendSuccess(res, { byType, monthly, byCase });
    });
}

module.exports = new DocumentController();