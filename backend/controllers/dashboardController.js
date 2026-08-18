const DashboardService = require('../services/DashboardService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class DashboardController extends BaseController {
    // ✅ جلب بيانات لوحة التحكم الرئيسية
    getDashboardData = this.asyncWrapper(async (req, res) => {
        const { userId, userRole, officeId } = req.session;

        const [stats, upcomingSessions, recentCases, notifications, recentActivities, recentTasks] = await Promise.all([
            DashboardService.getDashboardStats(userId, userRole, officeId),
            DashboardService.getUpcomingSessions(userId, userRole, officeId),
            DashboardService.getRecentCases(userId, userRole, officeId),
            DashboardService.getNotifications(userId, officeId),
            DashboardService.getRecentActivities(userId, userRole, officeId),
            DashboardService.getRecentTasks(userId, userRole, officeId)
        ]);

        this.sendSuccess(res, {
            stats,
            upcomingSessions,
            recentCases,
            notifications,
            recentActivities,
            recentTasks,
            lastUpdate: new Date().toISOString()
        });
    });

    // ✅ API: جلب الإشعارات
    getNotifications = this.asyncWrapper(async (req, res) => {
        const { unread } = req.query;
        const notifications = await DashboardService.getNotifications(req.session.userId, req.session.officeId, unread === 'true');
        this.sendSuccess(res, notifications);
    });

    // ✅ API: جلب الأنشطة الحديثة
    getRecentActivities = this.asyncWrapper(async (req, res) => {
        const activities = await DashboardService.getRecentActivities(req.session.userId, req.session.userRole, req.session.officeId);
        this.sendSuccess(res, activities);
    });

    // ✅ تعليم إشعار كمقروء
    markNotificationAsRead = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const { userId, officeId } = req.session;
        await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND office_id = ?', [id, userId, officeId]);
        this.sendSuccess(res, null, 'تم تعليم الإشعار كمقروء');
    });

    // ✅ جلب بيانات الرسم البياني
    getChartData = this.asyncWrapper(async (req, res) => {
        const { userId, userRole, officeId } = req.session;

        // 1. Cases monthly trend
        const monthlyCases = await db.all(`
            SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
            FROM cases WHERE is_active = 1 AND office_id = ? ${userRole !== 'admin' ? 'AND lawyer_id = ?' : ''}
            GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC LIMIT 6
        `, userRole !== 'admin' ? [officeId, userId] : [officeId]);

        // 2. Cases by status (for doughnut chart)
        const casesByStatus = await db.all(`
            SELECT status, COUNT(*) as count
            FROM cases WHERE is_active = 1 AND office_id = ? ${userRole !== 'admin' ? 'AND lawyer_id = ?' : ''}
            GROUP BY status
        `, userRole !== 'admin' ? [officeId, userId] : [officeId]);

        // 3. Monthly Revenue (Payments) - Last 6 months
        const monthlyRevenue = await db.all(`
            SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total
            FROM payments WHERE office_id = ?
            GROUP BY month ORDER BY month DESC LIMIT 6
        `, [officeId]);

        // 4. Monthly Expenses - Last 6 months
        const monthlyExpenses = await db.all(`
            SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as total
            FROM expenses WHERE office_id = ?
            GROUP BY month ORDER BY month DESC LIMIT 6
        `, [officeId]);

        this.sendSuccess(res, {
            monthlyCases,
            casesByStatus,
            monthlyRevenue: monthlyRevenue.reverse(),
            monthlyExpenses: monthlyExpenses.reverse()
        });
    });
}

module.exports = new DashboardController();