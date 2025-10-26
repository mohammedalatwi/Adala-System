const Database = require('../db/database');
const db = new Database();

class DashboardController {
    // ✅ جلب بيانات لوحة التحكم
    getDashboardData = async (req, res) => {
        try {
            const userId = req.session.userId;
            const userRole = req.session.userRole;

            // الإحصائيات العامة
            const stats = await db.getSystemStats(userRole === 'admin' ? null : userId);

            // الجلسات القادمة
            const upcomingSessions = await db.all(`
                SELECT 
                    s.*,
                    c.case_number,
                    c.title as case_title,
                    cl.full_name as client_name
                FROM sessions s
                LEFT JOIN cases c ON s.case_id = c.id
                LEFT JOIN clients cl ON c.client_id = cl.id
                WHERE s.session_date > datetime("now") 
                AND s.status = 'مجدول'
                ${userRole !== 'admin' ? 'AND c.lawyer_id = ?' : ''}
                ORDER BY s.session_date ASC
                LIMIT 5
            `, userRole !== 'admin' ? [userId] : []);

            // أحدث القضايا
            const recentCases = await db.all(`
                SELECT 
                    c.*,
                    cl.full_name as client_name,
                    u.full_name as lawyer_name
                FROM cases c
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                ${userRole !== 'admin' ? 'WHERE c.lawyer_id = ?' : ''}
                ORDER BY c.created_at DESC
                LIMIT 5
            `, userRole !== 'admin' ? [userId] : []);

            // الإشعارات الحديثة
            const notifications = await db.all(`
                SELECT * FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [userId]);

            res.json({
                success: true,
                data: {
                    stats,
                    upcomingSessions,
                    recentCases,
                    notifications
                }
            });

        } catch (error) {
            console.error('Dashboard data error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب بيانات لوحة التحكم'
            });
        }
    };

    // ✅ جلب الإشعارات
    getNotifications = async (req, res) => {
        try {
            const { page = 1, limit = 10, unread_only } = req.query;
            const offset = (page - 1) * limit;

            let whereConditions = ['user_id = ?'];
            let params = [req.session.userId];

            if (unread_only === 'true') {
                whereConditions.push('is_read = 0');
            }

            const whereClause = whereConditions.join(' AND ');

            const notifications = await db.all(`
                SELECT * FROM notifications 
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM notifications 
                WHERE ${whereClause}
            `, params);

            // إحصائيات الإشعارات
            const unreadCount = await db.get(`
                SELECT COUNT(*) as count 
                FROM notifications 
                WHERE user_id = ? AND is_read = 0
            `, [req.session.userId]);

            res.json({
                success: true,
                data: notifications,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                },
                unreadCount: unreadCount.count
            });

        } catch (error) {
            console.error('Get notifications error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الإشعارات'
            });
        }
    };

    // ✅ تعليم إشعار كمقروء
    markNotificationAsRead = async (req, res) => {
        try {
            const { id } = req.params;

            const result = await db.run(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                [id, req.session.userId]
            );

            if (result.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'الإشعار غير موجود'
                });
            }

            res.json({
                success: true,
                message: 'تم تعليم الإشعار كمقروء'
            });

        } catch (error) {
            console.error('Mark notification as read error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث الإشعار'
            });
        }
    };

    // ✅ جلب الأنشطة الحديثة
    getRecentActivities = async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const activities = await db.all(`
                SELECT 
                    a.*,
                    u.full_name as user_name
                FROM activities a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);

            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM activities
            `);

            res.json({
                success: true,
                data: activities,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get activities error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب الأنشطة'
            });
        }
    };
}

module.exports = new DashboardController();