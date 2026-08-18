const db = require('../db/database');

class CalendarService {
    async getEvents(userId, userRole, officeId, startDate, endDate) {
        const sessions = await this.getSessions(userId, userRole, officeId, startDate, endDate);
        const tasks = await this.getTasks(userId, userRole, officeId, startDate, endDate);

        return [
            ...sessions.map(s => ({
                id: `session_${s.id}`,
                title: `جلسة: ${s.case_title || 'بدون عنوان'}`,
                start: s.session_date,
                allDay: false,
                extendedProps: {
                    type: 'session',
                    location: s.location,
                    caseId: s.case_id
                },
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb'
            })),
            ...tasks.map(t => ({
                id: `task_${t.id}`,
                title: `مهمة: ${t.title}`,
                start: t.due_date,
                allDay: true,
                extendedProps: {
                    type: 'task',
                    priority: t.priority,
                    status: t.status
                },
                backgroundColor: t.priority === 'عالية' ? '#ef4444' : '#f59e0b',
                borderColor: t.priority === 'عالية' ? '#dc2626' : '#d97706'
            }))
        ];
    }

    async getSessions(userId, userRole, officeId, startDate, endDate) {
        let query, params;
        if (userRole === 'admin') {
            query = `
                SELECT s.*, c.title as case_title 
                FROM sessions s 
                LEFT JOIN cases c ON s.case_id = c.id 
                WHERE s.office_id = ? AND s.session_date BETWEEN ? AND ?
            `;
            params = [officeId, startDate, endDate];
        } else {
            query = `
                SELECT s.*, c.title as case_title 
                FROM sessions s 
                JOIN cases c ON s.case_id = c.id 
                WHERE s.office_id = ? AND c.lawyer_id = ? AND s.session_date BETWEEN ? AND ?
            `;
            params = [officeId, userId, startDate, endDate];
        }
        return await db.all(query, params);
    }

    async getTasks(userId, userRole, officeId, startDate, endDate) {
        let query, params;
        if (userRole === 'admin') {
            query = `
                SELECT * FROM tasks 
                WHERE office_id = ? AND due_date BETWEEN ? AND ?
            `;
            params = [officeId, startDate, endDate];
        } else {
            query = `
                SELECT * FROM tasks 
                WHERE office_id = ? AND assigned_to = ? AND due_date BETWEEN ? AND ?
            `;
            params = [officeId, userId, startDate, endDate];
        }
        return await db.all(query, params);
    }
}

module.exports = new CalendarService();
