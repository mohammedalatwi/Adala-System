const db = require('../db/database');

class DashboardController {

    // ✅ جلب بيانات لوحة التحكم الرئيسية
    getDashboardData = async (req, res) => {
        try {
            const userId = req.session.userId;
            const userRole = req.session.userRole;

            const officeId = req.session.officeId;

            console.log(`📊 جلب بيانات لوحة التحكم للمستخدم: ${userId}, المكتب: ${officeId}`);

            // جلب الإحصائيات الأساسية
            const stats = await this.getDashboardStats(userId, userRole, officeId);

            // جلب الجلسات القادمة
            const upcomingSessions = await this.getUpcomingSessions(userId, userRole, officeId);

            // جلب القضايا الحديثة
            const recentCases = await this.getRecentCases(userId, userRole, officeId);

            // جلب الإشعارات (Use internal method)
            const notifications = await this._getNotificationsData(userId, officeId);

            // جلب الأنشطة الحديثة (Use internal method)
            const recentActivities = await this._getRecentActivitiesData(userId, userRole, officeId);

            // جلب المهام الحديثة
            const recentTasks = await this.getRecentTasks(userId, userRole, officeId);

            res.json({
                success: true,
                data: {
                    stats,
                    upcomingSessions,
                    recentCases,
                    notifications,
                    recentActivities,
                    recentTasks,
                    lastUpdate: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ خطأ في جلب بيانات اللوحة:', error);
            console.error('Stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب بيانات لوحة التحكم',
                error: error.message
            });
        }
    };

    // ✅ جلب الإحصائيات
    getDashboardStats = async (userId, userRole, officeId) => {
        try {
            let statsQuery = '';
            let statsParams = [];

            if (userRole === 'admin') {
                // إحصائيات المدير (جميع البيانات في مكتبه)
                statsQuery = `
                    SELECT 
                        (SELECT COUNT(*) FROM cases WHERE is_active = 1 AND office_id = ?) as total_cases,
                        (SELECT COUNT(*) FROM clients WHERE is_active = 1 AND office_id = ?) as total_clients,
                        (SELECT COUNT(*) FROM sessions WHERE session_date > datetime('now') AND status = 'مجدول' AND office_id = ?) as upcoming_sessions,
                        (SELECT COUNT(*) FROM documents WHERE is_active = 1 AND office_id = ?) as total_documents,
                        (SELECT COUNT(*) FROM cases WHERE status = 'جديد' AND is_active = 1 AND office_id = ?) as new_cases,
                        (SELECT COUNT(*) FROM cases WHERE status = 'قيد الدراسة' AND is_active = 1 AND office_id = ?) as in_progress_cases,
                        (SELECT COUNT(*) FROM cases WHERE status = 'منتهي' AND is_active = 1 AND office_id = ?) as completed_cases,
                        (SELECT COUNT(*) FROM users WHERE is_active = 1 AND role = 'lawyer' AND office_id = ?) as total_lawyers
                `;
                statsParams = [officeId, officeId, officeId, officeId, officeId, officeId, officeId, officeId];
            } else {
                // إحصائيات المحامي (بياناته فقط)
                statsQuery = `
                    SELECT 
                        (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND is_active = 1 AND office_id = ?) as total_cases,
                        (SELECT COUNT(*) FROM clients WHERE created_by = ? AND is_active = 1 AND office_id = ?) as total_clients,
                        (SELECT COUNT(*) FROM sessions s 
                         JOIN cases c ON s.case_id = c.id 
                         WHERE s.session_date > datetime('now') AND s.status = 'مجدول' AND c.lawyer_id = ? AND s.office_id = ?) as upcoming_sessions,
                        (SELECT COUNT(*) FROM documents WHERE uploaded_by = ? AND is_active = 1 AND office_id = ?) as total_documents,
                        (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'جديد' AND is_active = 1 AND office_id = ?) as new_cases,
                        (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'قيد الدراسة' AND is_active = 1 AND office_id = ?) as in_progress_cases,
                        (SELECT COUNT(*) FROM cases WHERE lawyer_id = ? AND status = 'منتهي' AND is_active = 1 AND office_id = ?) as completed_cases,
                        0 as total_lawyers
                `;
                statsParams = [userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId];
            }

            const stats = await db.get(statsQuery, statsParams);
            return stats || {};

        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            return {};
        }
    };

    // ✅ جلب الجلسات القادمة
    getUpcomingSessions = async (userId, userRole, officeId) => {
        try {
            let sessionsQuery = '';
            let sessionsParams = [];

            if (userRole === 'admin') {
                sessionsQuery = `
                    SELECT 
                        s.*,
                        c.case_number,
                        c.title as case_title,
                        cl.full_name as client_name,
                        u.full_name as lawyer_name
                    FROM sessions s
                    LEFT JOIN cases c ON s.case_id = c.id
                    LEFT JOIN clients cl ON c.client_id = cl.id
                    LEFT JOIN users u ON c.lawyer_id = u.id
                    WHERE s.session_date > datetime('now') 
                    AND s.status = 'مجدول'
                    AND s.office_id = ?
                    ORDER BY s.session_date ASC
                    LIMIT 10
                `;
                sessionsParams = [officeId];
            } else {
                sessionsQuery = `
                    SELECT 
                        s.*,
                        c.case_number,
                        c.title as case_title,
                        cl.full_name as client_name,
                        u.full_name as lawyer_name
                    FROM sessions s
                    LEFT JOIN cases c ON s.case_id = c.id
                    LEFT JOIN clients cl ON c.client_id = cl.id
                    LEFT JOIN users u ON c.lawyer_id = u.id
                    WHERE s.session_date > datetime('now') 
                    AND s.status = 'مجدول'
                    AND c.lawyer_id = ?
                    AND s.office_id = ?
                    ORDER BY s.session_date ASC
                    LIMIT 10
                `;
                sessionsParams = [userId, officeId];
            }

            const sessions = await db.all(sessionsQuery, sessionsParams);
            return sessions || [];

        } catch (error) {
            console.error('Error getting upcoming sessions:', error);
            return [];
        }
    };

    // ✅ جلب القضايا الحديثة
    getRecentCases = async (userId, userRole, officeId) => {
        try {
            let casesQuery = '';
            let casesParams = [];

            if (userRole === 'admin') {
                casesQuery = `
                    SELECT 
                        c.*,
                        cl.full_name as client_name,
                        u.full_name as lawyer_name
                    FROM cases c
                    LEFT JOIN clients cl ON c.client_id = cl.id
                    LEFT JOIN users u ON c.lawyer_id = u.id
                    WHERE c.is_active = 1 AND c.office_id = ?
                    ORDER BY c.created_at DESC
                    LIMIT 10
                `;
                casesParams = [officeId];
            } else {
                casesQuery = `
                    SELECT 
                        c.*,
                        cl.full_name as client_name,
                        u.full_name as lawyer_name
                    FROM cases c
                    LEFT JOIN clients cl ON c.client_id = cl.id
                    LEFT JOIN users u ON c.lawyer_id = u.id
                    WHERE c.is_active = 1 AND c.lawyer_id = ? AND c.office_id = ?
                    ORDER BY c.created_at DESC
                    LIMIT 10
                `;
                casesParams = [userId, officeId];
            }

            const cases = await db.all(casesQuery, casesParams);
            return cases || [];

        } catch (error) {
            console.error('Error getting recent cases:', error);
            return [];
        }
    };

    // ✅ جلب المهام الحديثة
    getRecentTasks = async (userId, userRole, officeId) => {
        try {
            let tasksQuery = '';
            let tasksParams = [];

            if (userRole === 'admin') {
                tasksQuery = `
                    SELECT t.*, c.title as case_title
                    FROM tasks t
                    LEFT JOIN cases c ON t.case_id = c.id
                    WHERE t.status != 'مكتمل' AND t.office_id = ?
                    ORDER BY t.due_date ASC, t.priority DESC
                    LIMIT 5
                `;
                tasksParams = [officeId];
            } else {
                tasksQuery = `
                    SELECT t.*, c.title as case_title
                    FROM tasks t
                    LEFT JOIN cases c ON t.case_id = c.id
                    WHERE t.assigned_to = ? AND t.status != 'مكتمل' AND t.office_id = ?
                    ORDER BY t.due_date ASC, t.priority DESC
                    LIMIT 5
                `;
                tasksParams = [userId, officeId];
            }

            const tasks = await db.all(tasksQuery, tasksParams);
            return tasks || [];

        } catch (error) {
            console.error('Error getting recent tasks:', error);
            return [];
        }
    };

    // ✅ INTERNAL: Get Notifications Data
    _getNotificationsData = async (userId, officeId) => {
        try {
            return await db.all(`
                SELECT 
                    id,
                    title,
                    message,
                    type,
                    is_read,
                    created_at
                FROM notifications 
                WHERE user_id = ? AND office_id = ?
                ORDER BY created_at DESC 
                LIMIT 20
            `, [userId, officeId]);
        } catch (error) {
            console.error('Error getting notifications data:', error);
            return [];
        }
    };

    // ✅ API: Get Notifications
    getNotifications = async (req, res) => {
        try {
            const userId = req.session.userId;
            const officeId = req.session.officeId;
            const notifications = await this._getNotificationsData(userId, officeId);

            res.json({
                success: true,
                data: notifications || []
            });

        } catch (error) {
            console.error('Error getting notifications:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الإشعارات'
            });
        }
    };

    // ✅ INTERNAL: Get Recent Activities Data
    _getRecentActivitiesData = async (userId, userRole, officeId) => {
        try {
            let activitiesQuery = '';
            let activitiesParams = [];

            if (userRole === 'admin') {
                activitiesQuery = `
                    SELECT 
                        a.*,
                        u.full_name as user_name
                    FROM activities a
                    LEFT JOIN users u ON a.user_id = u.id
                    WHERE a.office_id = ?
                    ORDER BY a.created_at DESC
                    LIMIT 20
                `;
                activitiesParams = [officeId];
            } else {
                activitiesQuery = `
                    SELECT 
                        a.*,
                        u.full_name as user_name
                    FROM activities a
                    LEFT JOIN users u ON a.user_id = u.id
                    WHERE a.user_id = ? AND a.office_id = ?
                    ORDER BY a.created_at DESC
                    LIMIT 20
                `;
                activitiesParams = [userId, officeId];
            }

            return await db.all(activitiesQuery, activitiesParams);
        } catch (error) {
            console.error('Error getting recent activities data:', error);
            return [];
        }
    };

    // ✅ API: Get Recent Activities
    getRecentActivities = async (req, res) => {
        try {
            const userId = req.session.userId;
            const userRole = req.session.userRole;
            const officeId = req.session.officeId;

            const activities = await this._getRecentActivitiesData(userId, userRole, officeId);

            res.json({
                success: true,
                data: activities || []
            });

        } catch (error) {
            console.error('Error getting recent activities:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الأنشطة'
            });
        }
    };

    // ✅ تعليم إشعار كمقروء
    markNotificationAsRead = async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;

            await db.run(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND office_id = ?',
                [id, userId, req.session.officeId]
            );

            res.json({
                success: true,
                message: 'تم تعليم الإشعار كمقروء'
            });

        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث الإشعار'
            });
        }
    };

    // ✅ جلب بيانات الرسم البياني (ميزة إضافية)
    getChartData = async (req, res) => {
        try {
            const userId = req.session.userId;
            const userRole = req.session.userRole;
            const officeId = req.session.officeId;

            // بيانات القضايا حسب الشهر
            const monthlyCases = await db.all(`
                SELECT 
                    strftime('%Y-%m', created_at) as month,
                    COUNT(*) as count
                FROM cases 
                WHERE is_active = 1 AND office_id = ?
                ${userRole !== 'admin' ? 'AND lawyer_id = ?' : ''}
                GROUP BY strftime('%Y-%m', created_at)
                ORDER BY month DESC
                LIMIT 6
            `, userRole !== 'admin' ? [officeId, userId] : [officeId]);

            // القضايا حسب الحالة
            const casesByStatus = await db.all(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM cases 
                WHERE is_active = 1 AND office_id = ?
                ${userRole !== 'admin' ? 'AND lawyer_id = ?' : ''}
                GROUP BY status
            `, userRole !== 'admin' ? [officeId, userId] : [officeId]);

            res.json({
                success: true,
                data: {
                    monthlyCases: monthlyCases || [],
                    casesByStatus: casesByStatus || []
                }
            });

        } catch (error) {
            console.error('Error getting chart data:', error);
            console.error('User Context in Chart Error:', { userId: req.session.userId, userRole: req.session.userRole });
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب بيانات الرسوم البيانية',
                error: error.message
            });
        }
    };
}

module.exports = new DashboardController();