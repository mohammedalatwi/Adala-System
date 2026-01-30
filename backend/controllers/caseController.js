const db = require('../db/database');
const AuthMiddleware = require('../middleware/auth');

class CaseController {
    constructor() {
        this.db = db;
    }

    // ✅ إنشاء قضية جديدة
    createCase = async (req, res) => {
        try {
            const {
                case_number,
                title,
                description,
                case_type,
                client_id,
                lawyer_id,
                assistant_lawyer_id,
                status = 'جديد',
                priority = 'متوسط',
                court_name,
                court_type,
                judge_name,
                case_subject,
                legal_description,
                initial_claim_amount,
                expected_compensation,
                start_date,
                expected_end_date,
                next_session_date,
                is_confidential = false,
                tags
            } = req.body;

            const officeId = req.session.officeId;

            // التحقق من توفر رقم القضية
            const existingCase = await this.db.get(
                'SELECT id FROM cases WHERE case_number = ? AND office_id = ?',
                [case_number, officeId]
            );

            if (existingCase) {
                return res.status(400).json({
                    success: false,
                    message: 'رقم القضية موجود مسبقاً'
                });
            }

            const result = await db.run(
                `INSERT INTO cases (
                    case_number, title, description, case_type, client_id, lawyer_id, 
                    assistant_lawyer_id, status, priority, court_name, court_type, 
                    judge_name, case_subject, legal_description, initial_claim_amount,
                    expected_compensation, start_date, expected_end_date, next_session_date,
                    is_confidential, tags, office_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    case_number, title, description, case_type, client_id, lawyer_id,
                    assistant_lawyer_id, status, priority, court_name, court_type,
                    judge_name, case_subject, legal_description, initial_claim_amount,
                    expected_compensation, start_date, expected_end_date, next_session_date,
                    is_confidential ? 1 : 0, tags, officeId
                ]
            );

            // تسجيل النشاط
            await AuthMiddleware.logActivity(
                req.session.userId,
                `إنشاء قضية جديدة: ${title}`,
                'create',
                'case',
                result.id
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء القضية بنجاح',
                data: { id: result.id, case_number, title }
            });

        } catch (error) {
            console.error('Create case error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء القضية'
            });
        }
    };

    // ✅ جلب جميع القضايا
    getAllCases = async (req, res) => {
        try {
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

            // --- RBAC Implementation ---
            const userClientId = req.session.clientId; // Added for clients

            if (userRole === 'client') {
                if (!userClientId) {
                    return res.status(403).json({ success: false, message: 'غير مصرح للعميل بالوصول' });
                }
                whereConditions.push('c.client_id = ?');
                params.push(userClientId);
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                whereConditions.push('(c.lawyer_id = ? OR c.assistant_lawyer_id = ?)');
                params.push(userId, userId);
            } else if (userRole === 'trainee') {
                // المتدرب يرى فقط القضايا الموكلة له كمساعد
                whereConditions.push('c.assistant_lawyer_id = ?');
                params.push(userId);
            }
            // Admins see all, no extra where conditions.
            // ---------------------------

            const whereClause = whereConditions.join(' AND ');

            // جلب القضايا
            const cases = await this.db.all(`
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
            `, [...params, limit, offset]);

            // جلب العدد الإجمالي
            const totalResult = await this.db.get(`
                SELECT COUNT(*) as total 
                FROM cases c
                LEFT JOIN clients cl ON c.client_id = cl.id
                WHERE ${whereClause}
            `, params);

            res.json({
                success: true,
                data: cases,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get cases error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب القضايا'
            });
        }
    };

    // ✅ جلب قضية محددة
    getCaseById = async (req, res) => {
        try {
            const { id } = req.params;

            const caseData = await this.db.get(`
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
            `, [id, req.session.officeId]);

            if (!caseData) {
                return res.status(404).json({
                    success: false,
                    message: 'القضية غير موجودة'
                });
            }

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            let hasAccess = false;
            if (userRole === 'admin') {
                hasAccess = true;
            } else if (userRole === 'client' && caseData.client_id === userClientId) {
                hasAccess = true;
            } else if ((userRole === 'lawyer' || userRole === 'assistant') &&
                (caseData.lawyer_id === userId || caseData.assistant_lawyer_id === userId)) {
                hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'غير مصرح لك بالوصول لهذه القضية'
                });
            }
            // ---------------------------

            // جلب الجلسات المرتبطة
            const sessions = await this.db.all(`
                SELECT * FROM sessions 
                WHERE case_id = ? AND office_id = ?
                ORDER BY session_date DESC
            `, [id, req.session.officeId]);

            // جلب المستندات المرتبطة
            const documents = await this.db.all(`
                SELECT * FROM documents 
                WHERE case_id = ? AND office_id = ?
                ORDER BY uploaded_at DESC
            `, [id, req.session.officeId]);

            res.json({
                success: true,
                data: {
                    ...caseData,
                    sessions,
                    documents
                }
            });

        } catch (error) {
            console.error('Get case error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب القضية'
            });
        }
    };

    // ✅ تحديث قضية
    updateCase = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // التحقق من وجود القضية
            const existingCase = await this.db.get(
                'SELECT id, title FROM cases WHERE id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (!existingCase) {
                return res.status(404).json({
                    success: false,
                    message: 'القضية غير موجودة'
                });
            }

            const allowedFields = [
                'title', 'description', 'case_type', 'client_id', 'lawyer_id',
                'assistant_lawyer_id', 'status', 'priority', 'court_name',
                'court_type', 'judge_name', 'case_subject', 'legal_description',
                'initial_claim_amount', 'expected_compensation', 'start_date',
                'expected_end_date', 'actual_end_date', 'next_session_date',
                'is_confidential', 'tags'
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

            updates.push('updated_at = datetime("now")');
            values.push(id);

            await this.db.run(
                `UPDATE cases SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`,
                [...values, req.session.officeId]
            );

            // تسجيل النشاط
            await AuthMiddleware.logActivity(
                req.session.userId,
                `تحديث القضية: ${existingCase.title}`,
                'update',
                'case',
                id
            );

            res.json({
                success: true,
                message: 'تم تحديث القضية بنجاح'
            });

        } catch (error) {
            console.error('Update case error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث القضية'
            });
        }
    };

    // ✅ حذف قضية
    deleteCase = async (req, res) => {
        try {
            const { id } = req.params;

            // التحقق من وجود القضية
            const existingCase = await this.db.get(
                'SELECT id, title FROM cases WHERE id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (!existingCase) {
                return res.status(404).json({
                    success: false,
                    message: 'القضية غير موجودة'
                });
            }

            // التحقق من عدم وجود جلسات مرتبطة
            const sessionsCount = await this.db.get(
                'SELECT COUNT(*) as count FROM sessions WHERE case_id = ? AND office_id = ?',
                [id, req.session.officeId]
            );

            if (sessionsCount.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن حذف القضية لأنها تحتوي على جلسات مرتبطة'
                });
            }

            await this.db.run('DELETE FROM cases WHERE id = ? AND office_id = ?', [id, req.session.officeId]);

            // تسجيل النشاط
            await AuthMiddleware.logActivity(
                req.session.userId,
                `حذف القضية: ${existingCase.title}`,
                'delete',
                'case',
                id
            );

            res.json({
                success: true,
                message: 'تم حذف القضية بنجاح'
            });

        } catch (error) {
            console.error('Delete case error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف القضية'
            });
        }
    };

    // ✅ إحصائيات القضايا
    getCaseStats = async (req, res) => {
        try {
            const stats = await this.db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    CASE 
                        WHEN status = 'جديد' THEN 1
                        WHEN status = 'قيد الدراسة' THEN 2
                        WHEN status = 'قيد التنفيذ' THEN 3
                        WHEN status = 'منتهي' THEN 4
                        WHEN status = 'ملغي' THEN 5
                        ELSE 6
                    END as sort_order
                FROM cases 
                WHERE office_id = ?
                GROUP BY status
                ORDER BY sort_order
            `, [req.session.officeId]);

            const typeStats = await this.db.all(`
                SELECT case_type, COUNT(*) as count
                FROM cases 
                WHERE office_id = ?
                GROUP BY case_type
                ORDER BY count DESC
            `, [req.session.officeId]);

            const priorityStats = await this.db.all(`
                SELECT priority, COUNT(*) as count
                FROM cases 
                WHERE office_id = ?
                GROUP BY priority
                ORDER BY 
                    CASE priority
                        WHEN 'عاجل' THEN 1
                        WHEN 'عالي' THEN 2
                        WHEN 'متوسط' THEN 3
                        WHEN 'منخفض' THEN 4
                        ELSE 5
                    END
            `, [req.session.officeId]);

            res.json({
                success: true,
                data: {
                    byStatus: stats,
                    byType: typeStats,
                    byPriority: priorityStats
                }
            });

        } catch (error) {
            console.error('Case stats error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات القضايا'
            });
        }
    };
}

module.exports = new CaseController();