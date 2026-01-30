/**
 * notificationService.js - خدمة الإشعارات الذكية
 */

const db = require('../db/database');

class NotificationService {

    // ✅ إنشاء إشعار جديد
    static async createNotification(userId, title, message, type = 'info', relatedEntity = null) {
        try {
            const result = await db.run(
                `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [userId, title, message, type, relatedEntity?.type, relatedEntity?.id]
            );

            // إرسال إشعار في الوقت الحقيقي
            this.sendRealTimeNotification(userId, {
                id: result.id,
                title,
                message,
                type,
                relatedEntity,
                createdAt: new Date().toISOString()
            });

            console.log(`📢 تم إنشاء إشعار للمستخدم ${userId}: ${title}`);

            return result.id;
        } catch (error) {
            console.error('❌ خطأ في إنشاء الإشعار:', error);
            throw error;
        }
    }

    // ✅ إرسال إشعار فوري (للتطوير المستقبلي مع WebSockets)
    static sendRealTimeNotification(userId, notification) {
        // يمكن دمج هذا مع WebSockets أو Server-Sent Events مستقبلاً
        // حالياً نكتفي بالتسجيل في الكونسول
        console.log(`🔔 إشعار فوري للمستخدم ${userId}:`, {
            title: notification.title,
            type: notification.type,
            timestamp: new Date().toLocaleTimeString('ar-SA')
        });

        // هنا يمكن إضافة تكامل مع خدمات الإشعارات الخارجية
        // مثل: البريد الإلكتروني، الرسائل النصية، إلخ
    }

    // ✅ التحقق من الجلسات القريبة وإرسال إشعارات (بمراحل متعددة)
    static async checkUpcomingSessions() {
        try {
            console.log('🔍 التحقق من الجلسات القريبة (7أيام، 3أيام، 24ساعة، 2ساعة)...');

            const sessions = await db.all(`
                SELECT 
                    s.*, 
                    u.id as user_id, 
                    u.full_name as user_name,
                    c.case_number,
                    c.title as case_title,
                    ns.reminder_intervals as user_intervals
                FROM sessions s
                JOIN cases c ON s.case_id = c.id
                JOIN users u ON c.lawyer_id = u.id
                LEFT JOIN notification_settings ns ON u.id = ns.user_id
                WHERE s.session_date > datetime('now')
                AND s.status = 'مجدول'
                AND u.is_active = 1
            `);

            let notificationsSentCount = 0;

            for (const session of sessions) {
                const sessionDate = new Date(session.session_date);
                const now = new Date();
                const timeDiffMs = sessionDate - now;
                const hoursDiff = timeDiffMs / (1000 * 60 * 60);
                const daysDiff = hoursDiff / 24;

                let sentReminders = [];
                try {
                    sentReminders = JSON.parse(session.sent_reminders || '[]');
                } catch (e) { sentReminders = []; }

                // الفترات الزمنية الافتراضية أو المخصصة للمستخدم
                const intervals = session.user_intervals ? JSON.parse(session.user_intervals) : ["7d", "3d", "24h", "2h"];

                let intervalToNotify = null;

                // التحقق من الفترات (من الأبعد للأقرب)
                if (daysDiff <= 7 && daysDiff > 3 && intervals.includes("7d") && !sentReminders.includes("7d")) {
                    intervalToNotify = "7d";
                } else if (daysDiff <= 3 && daysDiff > 1 && intervals.includes("3d") && !sentReminders.includes("3d")) {
                    intervalToNotify = "3d";
                } else if (hoursDiff <= 24 && hoursDiff > 2 && intervals.includes("24h") && !sentReminders.includes("24h")) {
                    intervalToNotify = "24h";
                } else if (hoursDiff <= 2 && hoursDiff > 0 && intervals.includes("2h") && !sentReminders.includes("2h")) {
                    intervalToNotify = "2h";
                }

                if (intervalToNotify) {
                    let title = '';
                    let message = '';
                    let type = 'info';

                    switch (intervalToNotify) {
                        case "7d":
                            title = 'تذكير: جلسة بعد أسبوع 📅';
                            message = `تذكير مبكر بجلسة "${session.case_title}" بتاريخ ${sessionDate.toLocaleDateString('ar-SA')}`;
                            break;
                        case "3d":
                            title = 'تذكير: جلسة بعد 3 أيام ⏳';
                            message = `اقترب موعد جلسة "${session.case_title}" (بقي 3 أيام)`;
                            break;
                        case "24h":
                            title = 'جلسة غداً ⚠️';
                            message = `جلسة "${session.case_title}" غداً في ${sessionDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
                            type = 'warning';
                            break;
                        case "2h":
                            title = 'جلسة خلال ساعتين 🔥';
                            message = `ستبدأ جلسة "${session.case_title}" بعد قليل (ساعتين)`;
                            type = 'danger';
                            break;
                    }

                    await this.createNotification(session.user_id, title, message, type, { type: 'session', id: session.id });

                    // تحديث قائمة التنبيهات المرسلة
                    sentReminders.push(intervalToNotify);
                    await db.run(
                        'UPDATE sessions SET sent_reminders = ? WHERE id = ?',
                        [JSON.stringify(sentReminders), session.id]
                    );

                    notificationsSentCount++;
                }
            }

            return notificationsSentCount;
        } catch (error) {
            console.error('❌ خطأ في التحقق من الجلسات القريبة:', error);
            return 0;
        }
    }

    // ✅ إرسال تنبيه فوري عند تغيير حالة الجلسة أو موعدها
    static async sendInstantSessionAlert(sessionId, changeType, oldData = null, newData = null) {
        try {
            const session = await db.get(`
                SELECT s.*, c.title as case_title, c.lawyer_id, c.assistant_lawyer_id
                FROM sessions s
                JOIN cases c ON s.case_id = c.id
                WHERE s.id = ?
            `, [sessionId]);

            if (!session) return;

            let title = 'تحديث في الجلسة 📝';
            let message = '';
            let type = 'info';

            if (changeType === 'status') {
                message = `تغيرت حالة جلسة "${session.case_title}" إلى (${session.status})`;
                if (session.status === 'مؤجل') type = 'warning';
            } else if (changeType === 'time') {
                const newDate = new Date(session.session_date).toLocaleString('ar-SA');
                message = `تم تغيير موعد جلسة "${session.case_title}" إلى: ${newDate}`;
                type = 'warning';
            }

            const recipients = [session.lawyer_id];
            if (session.assistant_lawyer_id) recipients.push(session.assistant_lawyer_id);

            for (const userId of recipients) {
                await this.createNotification(userId, title, message, type, { type: 'session', id: session.id });
            }
        } catch (error) {
            console.error('❌ خطأ في إرسال التنبيه الفوري:', error);
        }
    }

    // ✅ إشعارات المهام المتأخرة
    static async checkOverdueTasks() {
        try {
            const overdueTasks = await db.all(`
                SELECT 
                    t.*,
                    u.id as user_id,
                    u.full_name as user_name
                FROM tasks t
                JOIN users u ON t.assigned_to = u.id
                WHERE t.due_date < datetime('now')
                AND t.status != 'مكتمل'
                AND t.notification_sent = 0
            `);

            for (const task of overdueTasks) {
                await this.createNotification(
                    task.user_id,
                    'مهمة متأخرة ⏰',
                    `المهمة "${task.title}" تجاوزت موعدها النهائي`,
                    'danger',
                    { type: 'task', id: task.id }
                );

                await db.run(
                    'UPDATE tasks SET notification_sent = 1 WHERE id = ?',
                    [task.id]
                );
            }

            console.log(`✅ تم إرسال إشعارات لـ ${overdueTasks.length} مهمة متأخرة`);
        } catch (error) {
            console.error('❌ خطأ في التحقق من المهام المتأخرة:', error);
        }
    }

    // ✅ إشعارات النظام العامة
    static async createSystemNotification(title, message, type = 'info', targetUsers = 'all') {
        try {
            let usersQuery = 'SELECT id FROM users WHERE is_active = 1';
            let queryParams = [];

            if (targetUsers === 'admins') {
                usersQuery += ' AND role = ?';
                queryParams.push('admin');
            } else if (targetUsers === 'lawyers') {
                usersQuery += ' AND role = ?';
                queryParams.push('lawyer');
            }

            const users = await db.all(usersQuery, queryParams);

            for (const user of users) {
                await this.createNotification(
                    user.id,
                    title,
                    message,
                    type,
                    { type: 'system', id: null }
                );
            }

            console.log(`✅ تم إرسال إشعار نظام لـ ${users.length} مستخدم`);
        } catch (error) {
            console.error('❌ خطأ في إنشاء إشعار النظام:', error);
        }
    }

    // ✅ جلب إشعارات المستخدم
    static async getUserNotifications(userId, limit = 20, unreadOnly = false) {
        try {
            let query = `
                SELECT * FROM notifications 
                WHERE user_id = ?
                ${unreadOnly ? 'AND is_read = 0' : ''}
                ORDER BY created_at DESC
                LIMIT ?
            `;

            const notifications = await db.all(query, [userId, limit]);
            return notifications;
        } catch (error) {
            console.error('❌ خطأ في جلب إشعارات المستخدم:', error);
            return [];
        }
    }

    // ✅ تعليم الإشعار كمقروء
    static async markAsRead(notificationId, userId = null) {
        try {
            let query = 'UPDATE notifications SET is_read = 1 WHERE id = ?';
            let params = [notificationId];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            const result = await db.run(query, params);
            return result.changes > 0;
        } catch (error) {
            console.error('❌ خطأ في تعليم الإشعار كمقروء:', error);
            return false;
        }
    }

    // ✅ حذف الإشعارات القديمة (أكثر من 30 يوم)
    static async cleanupOldNotifications(days = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const result = await db.run(
                'DELETE FROM notifications WHERE created_at < ? AND is_read = 1',
                [cutoffDate.toISOString()]
            );

            console.log(`🧹 تم حذف ${result.changes} إشعار قديم`);
            return result.changes;
        } catch (error) {
            console.error('❌ خطأ في تنظيف الإشعارات القديمة:', error);
            return 0;
        }
    }
}

// ✅ تصدير الخدمة
module.exports = NotificationService;

// ✅ بدء المهام الدورية إذا تم تشغيل الملف مباشرة
if (require.main === module) {
    console.log('🚀 بدء خدمة الإشعارات...');

    // التحقق من الجلسات القريبة كل 30 دقيقة
    setInterval(() => {
        NotificationService.checkUpcomingSessions();
    }, 30 * 60 * 1000);

    // التحقق من المهام المتأخرة كل ساعة
    setInterval(() => {
        NotificationService.checkOverdueTasks();
    }, 60 * 60 * 1000);

    // تنظيف الإشعارات القديمة يومياً
    setInterval(() => {
        NotificationService.cleanupOldNotifications();
    }, 24 * 60 * 60 * 1000);
}