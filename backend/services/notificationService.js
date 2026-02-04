const db = require('../db/database');
const EmailService = require('./EmailService');
const config = require('../config/config');

class NotificationService {
    constructor() {
        this.db = db;
    }

    /**
     * Create a notification for a user.
     */
    async createNotification({
        userId,
        title,
        message,
        type = 'info',
        relatedEntityType = null,
        relatedEntityId = null,
        actionUrl = null,
        officeId = null
    }) {
        try {
            const sql = `
                INSERT INTO notifications (
                    user_id, title, message, type, 
                    related_entity_type, related_entity_id, action_url, office_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                userId, title, message, type,
                relatedEntityType, relatedEntityId, actionUrl, officeId
            ];

            await this.db.run(sql, params);
            return true;
        } catch (error) {
            console.error('NotificationService Error:', error);
            return false;
        }
    }

    /**
     * Mark a notification as read.
     */
    async markAsRead(notificationId, userId) {
        return await this.db.run(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    }

    /**
     * Check for upcoming sessions and send notifications.
     */
    async checkUpcomingSessions() {
        const intervals = [
            { time: '-7 days', label: '7d', text: '7 أيام' },
            { time: '-3 days', label: '3d', text: '3 أيام' },
            { time: '-24 hours', label: '24h', text: '24 ساعة' },
            { time: '-2 hours', label: '2h', text: 'ساعتين' }
        ];

        for (const interval of intervals) {
            const sessions = await this.db.all(`
                SELECT s.*, c.title as case_title, 
                       l.full_name as lawyer_name, l.email as lawyer_email,
                       a.full_name as assistant_name, a.email as assistant_email
                FROM sessions s
                JOIN cases c ON s.case_id = c.id
                LEFT JOIN users l ON c.lawyer_id = l.id
                LEFT JOIN users a ON c.assistant_lawyer_id = a.id
                WHERE s.is_active = 1 
                AND s.status = 'مجدول'
                AND s.session_date <= datetime('now', '${interval.time.replace('-', '+')}')
                AND s.session_date > datetime('now')
                AND s.sent_reminders NOT LIKE '%"${interval.label}"%'
            `);

            for (const session of sessions) {
                const message = `تذكير: لديك جلسة ${session.session_type} للقضية "${session.case_title}" بعد ${interval.text}`;

                // Notify Lawyer
                await this.createNotification({
                    userId: session.lawyer_id,
                    title: 'تذكير بجلسة قادمة',
                    message,
                    type: 'warning',
                    relatedEntityType: 'session',
                    relatedEntityId: session.id,
                    officeId: session.office_id
                });

                if (config.features.enableEmailNotifications && session.lawyer_email) {
                    await EmailService.sendSessionReminder(
                        { full_name: session.lawyer_name, email: session.lawyer_email },
                        session,
                        interval.text
                    );
                }

                // Notify Assistant if exists
                if (session.assistant_lawyer_id) {
                    await this.createNotification({
                        userId: session.assistant_lawyer_id,
                        title: 'تذكير بجلسة قادمة',
                        message,
                        type: 'warning',
                        relatedEntityType: 'session',
                        relatedEntityId: session.id,
                        officeId: session.office_id
                    });

                    if (config.features.enableEmailNotifications && session.assistant_email) {
                        await EmailService.sendSessionReminder(
                            { full_name: session.assistant_name, email: session.assistant_email },
                            session,
                            interval.text
                        );
                    }
                }

                // Update sent_reminders
                let sentReminders = [];
                try {
                    sentReminders = JSON.parse(session.sent_reminders || '[]');
                } catch (e) { sentReminders = []; }

                sentReminders.push(interval.label);
                await this.db.run(
                    'UPDATE sessions SET sent_reminders = ? WHERE id = ?',
                    [JSON.stringify(sentReminders), session.id]
                );
            }
        }
    }

    /**
     * Check for overdue tasks and send notifications.
     */
    async checkOverdueTasks() {
        const tasks = await this.db.all(`
            SELECT t.*, u.full_name as assigned_name, u.email as assigned_email, c.title as case_title
            FROM tasks t
            JOIN users u ON t.assigned_to = u.id
            LEFT JOIN cases c ON t.case_id = c.id
            WHERE t.is_active = 1 
            AND t.status != 'مكتمل'
            AND t.due_date < datetime('now')
            AND t.notification_sent = 0
        `);

        for (const task of tasks) {
            const message = `المهمة "${task.title}" قد تجاوزت تاريخ الاستحقاق (${new Date(task.due_date).toLocaleDateString('ar-SA')})`;

            await this.createNotification({
                userId: task.assigned_to,
                title: 'تنبيه: مهمة متأخرة',
                message,
                type: 'danger',
                relatedEntityType: 'task',
                relatedEntityId: task.id,
                officeId: task.office_id
            });

            if (config.features.enableEmailNotifications && task.assigned_email) {
                await EmailService.sendTaskOverdueAlert(
                    { full_name: task.assigned_name, email: task.assigned_email },
                    task
                );
            }

            await this.db.run('UPDATE tasks SET notification_sent = 1 WHERE id = ?', [task.id]);
        }
    }
}

module.exports = new NotificationService();