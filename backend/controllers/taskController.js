const TaskService = require('../services/TaskService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class TaskController extends BaseController {
    // ✅ إنشاء مهمة جديدة
    createTask = this.asyncWrapper(async (req, res) => {
        const result = await TaskService.createTask(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم إضافة المهمة بنجاح');
    });

    // ✅ جلب جميع المهام
    getAllTasks = this.asyncWrapper(async (req, res) => {
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

        // --- RBAC ---
        const { userRole, userId } = req.session;
        if (userRole === 'trainee') {
            query += ' AND t.assigned_to = ?';
            params.push(userId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            query += ' AND (t.assigned_to = ? OR c.lawyer_id = ? OR c.assistant_lawyer_id = ?)';
            params.push(userId, userId, userId);
        }

        query += ' ORDER BY t.due_date ASC, t.priority DESC';

        const tasks = await db.all(query, params);
        this.sendSuccess(res, tasks);
    });

    // ✅ جلب مهمة محددة
    getTaskById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const task = await db.get(`
            SELECT t.*, c.title as case_title, u.full_name as assigned_to_name
            FROM tasks t
            LEFT JOIN cases c ON t.case_id = c.id
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.id = ? AND t.office_id = ?
        `, [id, req.session.officeId]);

        if (!task) throw new Error('المهمة غير موجودة');
        this.sendSuccess(res, task);
    });

    // ✅ تحديث مهمة
    updateTask = this.asyncWrapper(async (req, res) => {
        await TaskService.updateTask(req.params.id, req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم تحديث المهمة بنجاح');
    });

    // ✅ حذف مهمة
    deleteTask = this.asyncWrapper(async (req, res) => {
        await TaskService.deleteTask(req.params.id, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم حذف المهمة بنجاح');
    });
}

module.exports = new TaskController();
