const db = require('../db/database');
const ActivityService = require('./ActivityService');

class TaskService {
    constructor() {
        this.db = db;
    }

    async createTask(taskData, userId, officeId) {
        const {
            case_id,
            title,
            description,
            assigned_to,
            due_date,
            priority = 'متوسط'
        } = taskData;

        if (!title) throw new Error('عنوان المهمة مطلوب');

        const result = await this.db.run(
            `INSERT INTO tasks (case_id, title, description, assigned_to, due_date, priority, office_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [case_id, title, description, assigned_to || userId, due_date, priority, officeId]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'task',
            entityId: result.id,
            description: `إضافة مهمة جديدة: ${title}`,
            officeId
        });

        return { id: result.id, title };
    }

    async updateTask(id, updates, userId, officeId) {
        const allowedFields = ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to'];
        const updateFields = [];
        const values = [];

        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key) && updates[key] !== undefined) {
                updateFields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });

        if (updateFields.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updateFields.push('updated_at = datetime("now")');
        values.push(id, officeId);

        const result = await this.db.run(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ? AND office_id = ?`,
            values
        );

        if (result.changes === 0) throw new Error('المهمة غير موجودة');

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'task',
            entityId: id,
            description: `تحديث المهمة: ${updates.title || id}`,
            officeId
        });

        return true;
    }

    async deleteTask(id, userId, officeId) {
        const task = await this.db.get('SELECT title FROM tasks WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!task) throw new Error('المهمة غير موجودة');

        const result = await this.db.run('DELETE FROM tasks WHERE id = ? AND office_id = ?', [id, officeId]);
        if (result.changes === 0) throw new Error('المهمة غير موجودة');

        await ActivityService.logActivity({
            userId,
            actionType: 'delete',
            entityType: 'task',
            entityId: id,
            description: `حذف المهمة: ${task.title}`,
            officeId
        });

        return true;
    }
}

module.exports = new TaskService();
