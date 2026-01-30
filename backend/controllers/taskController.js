/**
 * taskController.js - نظام إدارة المهام
 */

const db = require('../db/database');

class TaskController {
    // ✅ إنشاء مهمة جديدة
    createTask = async (req, res) => {
        try {
            const {
                case_id,
                title,
                description,
                assigned_to,
                due_date,
                priority = 'متوسط'
            } = req.body;

            if (!title) {
                return res.status(400).json({ success: false, message: 'عنوان المهمة مطلوب' });
            }

            const result = await db.run(
                `INSERT INTO tasks (case_id, title, description, assigned_to, due_date, priority, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [case_id, title, description, assigned_to || req.session.userId, due_date, priority, req.session.officeId]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'create', 'task', result.id, `إضافة مهمة جديدة: ${title}`]
            );

            res.status(201).json({
                success: true,
                message: 'تم إضافة المهمة بنجاح',
                data: { id: result.id, title }
            });

        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء إضافة المهمة' });
        }
    };

    // ✅ جلب جميع المهام
    getAllTasks = async (req, res) => {
        try {
            const { case_id, assigned_to, status, priority } = req.query;
            let query = `
                SELECT t.*, c.title as case_title, u.full_name as assigned_to_name
                FROM tasks t
                LEFT JOIN cases c ON t.case_id = c.id
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.office_id = ?
            `;
            const params = [req.session.officeId];

            if (case_id) {
                query += ' AND t.case_id = ?';
                params.push(case_id);
            }
            if (assigned_to) {
                query += ' AND t.assigned_to = ?';
                params.push(assigned_to);
            }
            if (status) {
                query += ' AND t.status = ?';
                params.push(status);
            }
            if (priority) {
                query += ' AND t.priority = ?';
                params.push(priority);
            }

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;

            if (userRole === 'trainee') {
                // المتدرب يرى فقط المهام الموكلة له
                query += ' AND t.assigned_to = ?';
                params.push(userId);
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                // المحامي يرى مهامه ومهام القضايا التي يشارك فيها
                query += ' AND (t.assigned_to = ? OR c.lawyer_id = ? OR c.assistant_lawyer_id = ?)';
                params.push(userId, userId, userId);
            }
            // ---------------------------

            query += ' ORDER BY t.due_date ASC, t.priority DESC';

            const tasks = await db.all(query, params);
            res.json({ success: true, data: tasks });

        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب المهام' });
        }
    };

    // ✅ جلب مهمة محددة
    getTaskById = async (req, res) => {
        try {
            const { id } = req.params;
            const task = await db.get(`
                SELECT t.*, c.title as case_title, u.full_name as assigned_to_name
                FROM tasks t
                LEFT JOIN cases c ON t.case_id = c.id
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.id = ? AND t.office_id = ?
            `, [id, req.session.officeId]);

            if (!task) {
                return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
            }

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Get task error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب المهمة' });
        }
    };

    // ✅ تحديث مهمة
    updateTask = async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const allowedFields = ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to'];
            const updateFields = [];
            const values = [];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    updateFields.push(`${key} = ?`);
                    values.push(updates[key]);
                }
            });

            if (updateFields.length === 0) {
                return res.status(400).json({ success: false, message: 'لا توجد بيانات لتحديثها' });
            }

            updateFields.push('updated_at = datetime("now")');
            values.push(id);

            const result = await db.run(
                `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ? AND office_id = ?`,
                [...values, req.session.officeId]
            );

            if (result.changes === 0) {
                return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
            }

            res.json({ success: true, message: 'تم تحديث المهمة بنجاح' });

        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث المهمة' });
        }
    };

    // ✅ حذف مهمة
    deleteTask = async (req, res) => {
        try {
            const { id } = req.params;
            const result = await db.run('DELETE FROM tasks WHERE id = ? AND office_id = ?', [id, req.session.officeId]);

            if (result.changes === 0) {
                return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
            }

            res.json({ success: true, message: 'تم حذف المهمة بنجاح' });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف المهمة' });
        }
    };
}

module.exports = new TaskController();
