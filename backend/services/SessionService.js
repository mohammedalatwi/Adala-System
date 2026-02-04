const db = require('../db/database');
const ActivityService = require('./ActivityService');
const NotificationService = require('./NotificationService');

class SessionService {
    constructor() {
        this.db = db;
    }

    async createSession(sessionData, userId, officeId) {
        const {
            case_id, session_date, session_type, location, judge_name, session_notes,
            session_result, decisions_taken, next_steps, status = 'مجدول',
            preparation_status = 'غير معد', documents_required, adjournment_reason,
            attendees, city, judgment_content
        } = sessionData;

        const caseExists = await this.db.get('SELECT id, title FROM cases WHERE id = ? AND office_id = ?', [case_id, officeId]);
        if (!caseExists) throw new Error('القضية غير موجودة');

        const sessionsCount = await this.db.get('SELECT COUNT(*) as count FROM sessions WHERE case_id = ? AND office_id = ?', [case_id, officeId]);
        const session_number = (sessionsCount?.count || 0) + 1;

        const result = await this.db.run(
            `INSERT INTO sessions (
                case_id, session_number, session_date, session_type, location,
                judge_name, session_notes, session_result, decisions_taken,
                next_steps, status, preparation_status, documents_required,
                adjournment_reason, attendees, city, judgment_content,
                created_by, office_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                case_id, session_number, session_date, session_type, location,
                judge_name, session_notes, session_result, decisions_taken,
                next_steps, status, preparation_status, documents_required,
                adjournment_reason, attendees, city, judgment_content,
                userId, officeId
            ]
        );

        await this.db.run('UPDATE cases SET next_session_date = ?, updated_at = datetime("now") WHERE id = ?', [session_date, case_id]);

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'session',
            entityId: result.id,
            description: `إنشاء جلسة جديدة للقضية: ${caseExists.title}`,
            officeId
        });

        await NotificationService.createNotification({
            userId,
            title: 'جلسة جديدة',
            message: `تم جدولة جلسة جديدة للقضية: ${caseExists.title}`,
            type: 'info',
            relatedEntityType: 'session',
            relatedEntityId: result.id,
            officeId
        });

        return { id: result.id, session_number, session_date };
    }

    async updateSession(sessionId, updateData, userId, officeId) {
        const existingSession = await this.db.get('SELECT id, case_id, status FROM sessions WHERE id = ? AND office_id = ? AND is_active = 1', [sessionId, officeId]);
        if (!existingSession) throw new Error('الجلسة غير موجودة');

        const allowedFields = [
            'session_number', 'session_date', 'session_type', 'location', 'judge_name', 'session_notes',
            'session_result', 'decisions_taken', 'next_steps', 'status', 'preparation_status',
            'documents_required', 'adjournment_reason', 'attendees', 'city', 'judgment_content'
        ];

        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updates.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updates.push('updated_at = datetime("now")');
        values.push(sessionId, officeId);

        await this.db.run(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`, values);

        if (updateData.session_date) {
            await this.db.run('UPDATE cases SET next_session_date = ?, updated_at = datetime("now") WHERE id = ?', [updateData.session_date, existingSession.case_id]);
            await NotificationService.sendInstantSessionAlert(sessionId, 'time');
        }

        if (updateData.status && updateData.status !== existingSession.status) {
            await NotificationService.sendInstantSessionAlert(sessionId, 'status');
        }

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'session',
            entityId: sessionId,
            description: 'تحديث بيانات الجلسة',
            officeId
        });

        return true;
    }

    async deleteSession(sessionId, userId, officeId) {
        const existingSession = await this.db.get('SELECT id FROM sessions WHERE id = ? AND office_id = ? AND is_active = 1', [sessionId, officeId]);
        if (!existingSession) throw new Error('الجلسة غير موجودة');

        await this.db.run('UPDATE sessions SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND office_id = ?', [sessionId, officeId]);

        await ActivityService.logActivity({
            userId,
            actionType: 'delete',
            entityType: 'session',
            entityId: sessionId,
            description: 'حذف الجلسة',
            officeId
        });

        return true;
    }
}

module.exports = new SessionService();
