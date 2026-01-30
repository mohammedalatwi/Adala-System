const db = require('../db/database');
const path = require('path');
const fs = require('fs');

class DocumentController {
    // ✅ إنشاء مستند جديد
    createDocument = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'لم يتم رفع أي ملف'
                });
            }

            const {
                case_id,
                session_id,
                title,
                description,
                document_type,
                version = '1.0',
                is_confidential = false
            } = req.body;

            const file_name = req.file.originalname;
            const file_path = req.file.path;
            const file_size = req.file.size;
            const file_type = req.file.mimetype;

            // التحقق من وجود القضية أو الجلسة
            if (case_id) {
                const caseExists = await db.get(
                    'SELECT id, title FROM cases WHERE id = ? AND office_id = ?',
                    [case_id, req.session.officeId]
                );
                if (!caseExists) {
                    return res.status(404).json({
                        success: false,
                        message: 'القضية غير موجودة'
                    });
                }
            }

            if (session_id) {
                const sessionExists = await db.get(
                    'SELECT id FROM sessions WHERE id = ? AND office_id = ?',
                    [session_id, req.session.officeId]
                );
                if (!sessionExists) {
                    return res.status(404).json({
                        success: false,
                        message: 'الجلسة غير موجودة'
                    });
                }
            }

            const result = await db.run(
                `INSERT INTO documents (
                    case_id, session_id, title, description, document_type,
                    file_name, file_path, file_size, file_type, version,
                    is_confidential, uploaded_by, office_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    case_id, session_id, title, description, document_type,
                    file_name, file_path, file_size, file_type, version,
                    is_confidential ? 1 : 0, req.session.userId, req.session.officeId
                ]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'create', 'document', result.id, `رفع مستند جديد: ${title}`]
            );

            res.status(201).json({
                success: true,
                message: 'تم رفع المستند بنجاح',
                data: { id: result.id, title, file_name }
            });

        } catch (error) {
            console.error('Create document error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء رفع المستند'
            });
        }
    };

    // ✅ جلب جميع المستندات
    getAllDocuments = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                document_type,
                case_id,
                session_id,
                search
            } = req.query;

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

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            if (userRole === 'client') {
                whereConditions.push('c.client_id = ?');
                params.push(userClientId);
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                whereConditions.push('(c.lawyer_id = ? OR c.assistant_lawyer_id = ?)');
                params.push(userId, userId);
            } else if (userRole === 'trainee') {
                // المتدرب يرى فقط مستندات القضايا الموكلة له
                whereConditions.push('c.assistant_lawyer_id = ?');
                params.push(userId);
            }
            // ---------------------------

            const whereClause = whereConditions.join(' AND ');

            const documents = await db.all(`
                SELECT 
                    d.*,
                    c.case_number,
                    c.title as case_title,
                    s.session_number,
                    u.full_name as uploaded_by_name
                FROM documents d
                LEFT JOIN cases c ON d.case_id = c.id
                LEFT JOIN sessions s ON d.session_id = s.id
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE ${whereClause} AND d.is_active = 1
                ORDER BY d.uploaded_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM documents d
                WHERE ${whereClause} AND d.is_active = 1
            `, params);

            res.json({
                success: true,
                data: documents,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get documents error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المستندات'
            });
        }
    };

    // ✅ جلب مستند محدد
    getDocumentById = async (req, res) => {
        try {
            const { id } = req.params;

            const document = await db.get(`
                SELECT 
                    d.*,
                    c.case_number,
                    c.title as case_title,
                    s.session_number,
                    s.session_date,
                    u.full_name as uploaded_by_name,
                    u.email as uploaded_by_email
                FROM documents d
                LEFT JOIN cases c ON d.case_id = c.id
                LEFT JOIN sessions s ON d.session_id = s.id
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE d.id = ? AND d.office_id = ? AND d.is_active = 1
            `, [id, req.session.officeId]);

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'المستند غير موجود'
                });
            }

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            let hasAccess = false;
            if (userRole === 'admin') {
                hasAccess = true;
            } else if (userRole === 'client') {
                // We need to check if the case belongs to the client
                const caseObj = await db.get('SELECT client_id FROM cases WHERE id = ?', [document.case_id]);
                if (caseObj && caseObj.client_id === userClientId) hasAccess = true;
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                // Check if lawyer is assigned to the case
                const caseObj = await db.get('SELECT lawyer_id, assistant_lawyer_id FROM cases WHERE id = ?', [document.case_id]);
                if (caseObj && (caseObj.lawyer_id === userId || caseObj.assistant_lawyer_id === userId)) hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'غير مصرح لك بالوصول لهذا المستند'
                });
            }
            // ---------------------------

            res.json({
                success: true,
                data: document
            });

        } catch (error) {
            console.error('Get document error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب المستند'
            });
        }
    };

    // ✅ تحديث مستند
    updateDocument = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const existingDocument = await db.get(
                'SELECT id, title FROM documents WHERE id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (!existingDocument) {
                return res.status(404).json({
                    success: false,
                    message: 'المستند غير موجود'
                });
            }

            const allowedFields = [
                'title', 'description', 'document_type', 'version', 'is_confidential'
            ];

            const updates = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key) && updateData[key] !== undefined) {
                    if (key === 'is_confidential') {
                        updates.push(`${key} = ?`);
                        values.push(updateData[key] ? 1 : 0);
                    } else {
                        updates.push(`${key} = ?`);
                        values.push(updateData[key]);
                    }
                }
            });

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا توجد بيانات لتحديثها'
                });
            }

            updates.push('last_modified = datetime("now")');
            values.push(id);

            await db.run(
                `UPDATE documents SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`,
                [...values, req.session.officeId]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'update', 'document', id, `تحديث المستند: ${existingDocument.title}`]
            );

            res.json({
                success: true,
                message: 'تم تحديث المستند بنجاح'
            });

        } catch (error) {
            console.error('Update document error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث المستند'
            });
        }
    };

    // ✅ حذف مستند
    deleteDocument = async (req, res) => {
        try {
            const { id } = req.params;

            const existingDocument = await db.get(
                'SELECT id, title, file_path FROM documents WHERE id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (!existingDocument) {
                return res.status(404).json({
                    success: false,
                    message: 'المستند غير موجود'
                });
            }

            // Soft delete: update is_active to 0
            await db.run('UPDATE documents SET is_active = 0 WHERE id = ? AND office_id = ?', [id, req.session.officeId]);

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'delete', 'document', id, `حذف المستند (Soft Delete): ${existingDocument.title}`]
            );

            res.json({
                success: true,
                message: 'تم حذف المستند بنجاح'
            });

        } catch (error) {
            console.error('Delete document error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف المستند'
            });
        }
    };

    // ✅ تحميل المستند
    downloadDocument = async (req, res) => {
        try {
            const { id } = req.params;

            const document = await db.get(
                'SELECT file_name, file_path, case_id FROM documents WHERE id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: 'المستند غير موجود'
                });
            }

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            let hasAccess = false;
            if (userRole === 'admin') {
                hasAccess = true;
            } else if (userRole === 'client') {
                const caseObj = await db.get('SELECT client_id FROM cases WHERE id = ?', [document.case_id]);
                if (caseObj && caseObj.client_id === userClientId) hasAccess = true;
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                const caseObj = await db.get('SELECT lawyer_id, assistant_lawyer_id FROM cases WHERE id = ?', [document.case_id]);
                if (caseObj && (caseObj.lawyer_id === userId || caseObj.assistant_lawyer_id === userId)) hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'غير مصرح لك بتحميل هذا المستند'
                });
            }
            // ---------------------------

            if (!document.file_path || !fs.existsSync(document.file_path)) {
                return res.status(404).json({
                    success: false,
                    message: 'الملف غير موجود على الخادم'
                });
            }

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'download', 'document', id, `تحميل المستند: ${document.file_name}`]
            );

            res.download(document.file_path, document.file_name);

        } catch (error) {
            console.error('Download document error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحميل المستند'
            });
        }
    };

    // ✅ إحصائيات المستندات
    getDocumentStats = async (req, res) => {
        try {
            const stats = await db.all(`
                SELECT 
                    document_type,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM documents 
                WHERE office_id = ?
                GROUP BY document_type
                ORDER BY count DESC
            `, [req.session.officeId]);

            const monthlyStats = await db.all(`
                SELECT 
                    strftime('%Y-%m', uploaded_at) as month,
                    COUNT(*) as count,
                    SUM(file_size) as total_size
                FROM documents 
                WHERE uploaded_at >= datetime('now', '-6 months') AND office_id = ?
                GROUP BY month
                ORDER BY month
            `, [req.session.officeId]);

            const caseStats = await db.all(`
                SELECT 
                    c.case_number,
                    c.title as case_title,
                    COUNT(d.id) as documents_count,
                    SUM(d.file_size) as total_size
                FROM cases c
                LEFT JOIN documents d ON c.id = d.case_id
                WHERE c.office_id = ?
                GROUP BY c.id
                HAVING documents_count > 0
                ORDER BY documents_count DESC
                LIMIT 10
            `, [req.session.officeId]);

            res.json({
                success: true,
                data: {
                    byType: stats,
                    monthly: monthlyStats,
                    byCase: caseStats
                }
            });

        } catch (error) {
            console.error('Document stats error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات المستندات'
            });
        }
    };
}

module.exports = new DocumentController();