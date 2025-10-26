const Database = require('../db/database');
const db = new Database();

class SessionController {
    // ✅ إنشاء جلسة جديدة
    createSession = async (req, res) => {
        try {
            const {
                case_id,
                session_number,
                session_date,
                session_type,
                location,
                judge_name,
                session_notes,
                session_result,
                decisions_taken,
                next_steps,
                status = 'مجدول',
                preparation_status = 'غير معد',
                documents_required
            } = req.body;

            // التحقق من وجود القضية
            const caseExists = await db.get(
                'SELECT id, title FROM cases WHERE id = ?',
                [case_id]
            );

            if (!caseExists) {
                return res.status(404).json({
                    success: false,
                    message: 'القضية غير موجودة'
                });
            }

            const result = await db.run(
                `INSERT INTO sessions (
                    case_id, session_number, session_date, session_type, location,
                    judge_name, session_notes, session_result, decisions_taken,
                    next_steps, status, preparation_status, documents_required, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    case_id, session_number, session_date, session_type, location,
                    judge_name, session_notes, session_result, decisions_taken,
                    next_steps, status, preparation_status, documents_required, req.session.userId
                ]
            );

            // تحديث تاريخ الجلسة التالية في القضية
            await db.run(
                'UPDATE cases SET next_session_date = ?, updated_at = datetime("now") WHERE id = ?',
                [session_date, case_id]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'create', 'session', result.id, `إنشاء جلسة جديدة للقضية: ${caseExists.title}`]
            );

            // إنشاء إشعار
            await db.run(
                `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    req.session.userId,
                    'جلسة جديدة',
                    `تم جدولة جلسة جديدة للقضية: ${caseExists.title}`,
                    'info',
                    'session',
                    result.id
                ]
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء الجلسة بنجاح',
                data: { id: result.id, session_number, session_date }
            });

        } catch (error) {
            console.error('Create session error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء الجلسة'
            });
        }
    };

    // ✅ جلب جميع الجلسات
    getAllSessions = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                case_id,
                upcoming
            } = req.query;

            const offset = (page - 1) * limit;
            let whereConditions = ['1=1'];
            let params = [];

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

            const whereClause = whereConditions.join(' AND ');

            const sessions = await db.all(`
                SELECT 
                    s.*,
                    c.case_number,
                    c.title as case_title,
                    c.case_type,
                    cl.full_name as client_name,
                    u.full_name as created_by_name
                FROM sessions s
                LEFT JOIN cases c ON s.case_id = c.id
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON s.created_by = u.id
                WHERE ${whereClause}
                ORDER BY s.session_date DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM sessions s
                WHERE ${whereClause}
            `, params);

            res.json({
                success: true,
                data: sessions,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الجلسات'
            });
        }
    };

    // ✅ جلب الجلسات القادمة
    getUpcomingSessions = async (req, res) => {
        try {
            const { limit = 5 } = req.query;

            const sessions = await db.all(`
                SELECT 
                    s.*,
                    c.case_number,
                    c.title as case_title,
                    c.case_type,
                    cl.full_name as client_name,
                    u.full_name as lawyer_name
                FROM sessions s
                LEFT JOIN cases c ON s.case_id = c.id
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                WHERE s.session_date > datetime("now") 
                AND s.status = 'مجدول'
                ORDER BY s.session_date ASC
                LIMIT ?
            `, [limit]);

            res.json({
                success: true,
                data: sessions
            });

        } catch (error) {
            console.error('Get upcoming sessions error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الجلسات القادمة'
            });
        }
    };

    // ✅ جلب جلسة محددة
    getSessionById = async (req, res) => {
        try {
            const { id } = req.params;

            const session = await db.get(`
                SELECT 
                    s.*,
                    c.case_number,
                    c.title as case_title,
                    c.case_type,
                    c.client_id,
                    cl.full_name as client_name,
                    cl.phone as client_phone,
                    u.full_name as lawyer_name,
                    u.phone as lawyer_phone
                FROM sessions s
                LEFT JOIN cases c ON s.case_id = c.id
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                WHERE s.id = ?
            `, [id]);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'الجلسة غير موجودة'
                });
            }

            // جلب المستندات المرتبطة
            const documents = await db.all(`
                SELECT * FROM documents 
                WHERE session_id = ? 
                ORDER BY uploaded_at DESC
            `, [id]);

            res.json({
                success: true,
                data: {
                    ...session,
                    documents
                }
            });

        } catch (error) {
            console.error('Get session error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الجلسة'
            });
        }
    };

    // ✅ تحديث جلسة
    updateSession = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const existingSession = await db.get(
                'SELECT id, case_id FROM sessions WHERE id = ?',
                [id]
            );

            if (!existingSession) {
                return res.status(404).json({
                    success: false,
                    message: 'الجلسة غير موجودة'
                });
            }

            const allowedFields = [
                'session_number', 'session_date', 'session_type', 'location',
                'judge_name', 'session_notes', 'session_result', 'decisions_taken',
                'next_steps', 'status', 'preparation_status', 'documents_required'
            ];

            const updates = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key) && updateData[key] !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(updateData[key]);
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

            await db.run(
                `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // إذا تم تحديث تاريخ الجلسة، تحديث القضية
            if (updateData.session_date) {
                await db.run(
                    'UPDATE cases SET next_session_date = ?, updated_at = datetime("now") WHERE id = ?',
                    [updateData.session_date, existingSession.case_id]
                );
            }

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'update', 'session', id, 'تحديث بيانات الجلسة']
            );

            res.json({
                success: true,
                message: 'تم تحديث الجلسة بنجاح'
            });

        } catch (error) {
            console.error('Update session error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث الجلسة'
            });
        }
    };

    // ✅ حذف جلسة
    deleteSession = async (req, res) => {
        try {
            const { id } = req.params;

            const existingSession = await db.get(
                'SELECT id, case_id FROM sessions WHERE id = ?',
                [id]
            );

            if (!existingSession) {
                return res.status(404).json({
                    success: false,
                    message: 'الجلسة غير موجودة'
                });
            }

            await db.run('DELETE FROM sessions WHERE id = ?', [id]);

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'delete', 'session', id, 'حذف الجلسة']
            );

            res.json({
                success: true,
                message: 'تم حذف الجلسة بنجاح'
            });

        } catch (error) {
            console.error('Delete session error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف الجلسة'
            });
        }
    };

    // ✅ إحصائيات الجلسات
    getSessionStats = async (req, res) => {
        try {
            const stats = await db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    CASE 
                        WHEN status = 'مجدول' THEN 1
                        WHEN status = 'منعقد' THEN 2
                        WHEN status = 'ملغي' THEN 3
                        WHEN status = 'مؤجل' THEN 4
                        WHEN status = 'منتهي' THEN 5
                        ELSE 6
                    END as sort_order
                FROM sessions 
                GROUP BY status
                ORDER BY sort_order
            `);

            const typeStats = await db.all(`
                SELECT session_type, COUNT(*) as count
                FROM sessions 
                GROUP BY session_type
                ORDER BY count DESC
            `);

            const monthlyStats = await db.all(`
                SELECT 
                    strftime('%Y-%m', session_date) as month,
                    COUNT(*) as count
                FROM sessions 
                WHERE session_date >= datetime('now', '-6 months')
                GROUP BY month
                ORDER BY month
            `);

            res.json({
                success: true,
                data: {
                    byStatus: stats,
                    byType: typeStats,
                    monthly: monthlyStats
                }
            });

        } catch (error) {
            console.error('Session stats error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات الجلسات'
            });
        }
    };
}

module.exports = new SessionController();