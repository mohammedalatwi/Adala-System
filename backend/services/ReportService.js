const db = require('../db/database');

class ReportService {
    constructor() {
        this.db = db;
    }

    async generateCasesReport(filters, officeId) {
        const { startDate, endDate, status, case_type, lawyer_id, page = 1, limit = 50 } = filters;
        const offset = (page - 1) * limit;

        let whereConditions = ['c.is_active = 1', 'c.office_id = ?'];
        let params = [officeId];

        if (startDate && endDate) {
            whereConditions.push('c.created_at BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }
        if (status) {
            whereConditions.push('c.status = ?');
            params.push(status);
        }
        if (case_type) {
            whereConditions.push('c.case_type = ?');
            params.push(case_type);
        }
        if (lawyer_id) {
            whereConditions.push('c.lawyer_id = ?');
            params.push(lawyer_id);
        }

        const whereClause = whereConditions.join(' AND ');

        const cases = await this.db.all(`
            SELECT 
                c.*, cl.full_name as client_name, cl.phone as client_phone, u.full_name as lawyer_name, u.specialization as lawyer_specialization,
                (SELECT COUNT(*) FROM sessions WHERE case_id = c.id) as sessions_count,
                (SELECT COUNT(*) FROM documents WHERE case_id = c.id AND is_active = 1) as documents_count,
                (SELECT MAX(session_date) FROM sessions WHERE case_id = c.id) as last_session_date
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            WHERE ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const stats = await this.generateCasesStats(whereClause, params);

        return {
            cases,
            stats,
            pagination: {
                total: stats.total_cases,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(stats.total_cases / limit)
            }
        };
    }

    async generateCasesStats(whereClause, params) {
        return await this.db.get(`
            SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'جديد' THEN 1 END) as new_cases,
                COUNT(CASE WHEN status = 'قيد الدراسة' THEN 1 END) as in_progress_cases,
                COUNT(CASE WHEN status = 'قيد التنفيذ' THEN 1 END) as in_action_cases,
                COUNT(CASE WHEN status = 'منتهي' THEN 1 END) as completed_cases,
                COUNT(CASE WHEN status = 'ملغي' THEN 1 END) as cancelled_cases,
                COUNT(CASE WHEN priority = 'عالي' THEN 1 END) as high_priority_cases,
                COUNT(CASE WHEN priority = 'متوسط' THEN 1 END) as medium_priority_cases,
                COUNT(CASE WHEN priority = 'منخفض' THEN 1 END) as low_priority_cases,
                AVG(JULIANDAY(COALESCE(actual_end_date, datetime('now'))) - JULIANDAY(start_date)) as avg_duration_days
            FROM cases 
            WHERE ${whereClause}
        `, params) || {};
    }

    async generatePerformanceReport(filters, officeId) {
        const { period = 'month', startDate, endDate } = filters;
        let dateFilter = '';
        let dateParams = [officeId];

        if (startDate && endDate) {
            dateFilter = 'AND c.created_at BETWEEN ? AND ?';
            dateParams = [startDate, endDate];
        } else {
            const dateRanges = { 'week': "datetime('now', '-7 days')", 'month': "datetime('now', '-1 month')", 'quarter': "datetime('now', '-3 months')", 'year': "datetime('now', '-1 year')" };
            if (dateRanges[period]) dateFilter = `AND c.created_at >= ${dateRanges[period]} `;
        }

        const performanceData = await this.db.all(`
            SELECT
                u.id, u.full_name, u.specialization, u.experience_years, u.avatar_url,
                COUNT(DISTINCT c.id) as total_cases, COUNT(DISTINCT s.id) as total_sessions, COUNT(DISTINCT cl.id) as total_clients,
                COUNT(DISTINCT CASE WHEN c.status = 'منتهي' THEN c.id END) as completed_cases,
                COUNT(DISTINCT CASE WHEN c.status = 'جديد' THEN c.id END) as new_cases,
                COUNT(DISTINCT CASE WHEN c.status = 'قيد الدراسة' THEN c.id END) as in_progress_cases,
                ROUND(CASE WHEN COUNT(DISTINCT c.id) > 0 THEN (COUNT(DISTINCT CASE WHEN c.status = 'منتهي' THEN c.id END) * 100.0 / COUNT(DISTINCT c.id)) ELSE 0 END, 2) as success_rate,
                AVG(CASE WHEN c.status = 'منتهي' THEN JULIANDAY(c.actual_end_date) - JULIANDAY(c.start_date) ELSE NULL END) as avg_case_duration,
                COUNT(DISTINCT CASE WHEN c.priority = 'عالي' THEN c.id END) as high_priority_cases,
                MAX(c.created_at) as last_case_date
            FROM users u
            LEFT JOIN cases c ON u.id = c.lawyer_id AND c.is_active = 1 AND c.office_id = ? ${dateFilter}
            LEFT JOIN sessions s ON c.id = s.case_id
            LEFT JOIN clients cl ON u.id = cl.created_by AND cl.is_active = 1 AND cl.office_id = ?
            WHERE u.role = 'lawyer' AND u.is_active = 1 AND u.office_id = ?
            GROUP BY u.id
            ORDER BY success_rate DESC, total_cases DESC
        `, [...dateParams, officeId, officeId]);

        return {
            lawyers: performanceData,
            analysis: this.analyzePerformance(performanceData)
        };
    }

    analyzePerformance(performanceData) {
        if (!performanceData || performanceData.length === 0) return {};
        const totalCases = performanceData.reduce((sum, lawyer) => sum + lawyer.total_cases, 0);
        const avgSuccessRate = performanceData.reduce((sum, lawyer) => sum + lawyer.success_rate, 0) / performanceData.length;
        const topPerformers = performanceData.filter(lawyer => lawyer.success_rate >= 80).sort((a, b) => b.success_rate - a.success_rate).slice(0, 3);
        const needsImprovement = performanceData.filter(lawyer => lawyer.success_rate < 50 && lawyer.total_cases > 0).sort((a, b) => a.success_rate - b.success_rate);

        return {
            totalLawyers: performanceData.length,
            totalCases,
            averageSuccessRate: Math.round(avgSuccessRate * 100) / 100,
            topPerformers: topPerformers.map(lawyer => ({ name: lawyer.full_name, successRate: lawyer.success_rate, totalCases: lawyer.total_cases })),
            needsImprovement: needsImprovement.map(lawyer => ({ name: lawyer.full_name, successRate: lawyer.success_rate, totalCases: lawyer.total_cases })),
            busiestLawyer: performanceData.reduce((max, lawyer) => lawyer.total_cases > max.total_cases ? lawyer : max, performanceData[0])
        };
    }

    async generateSessionsReport(filters, officeId) {
        const { startDate, endDate, status, session_type } = filters;
        let whereConditions = ['s.is_active = 1', 's.office_id = ?'];
        let params = [officeId];

        if (startDate && endDate) {
            whereConditions.push('s.session_date BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }
        if (status) {
            whereConditions.push('s.status = ?');
            params.push(status);
        }
        if (session_type) {
            whereConditions.push('s.session_type = ?');
            params.push(session_type);
        }

        const whereClause = whereConditions.join(' AND ');

        const sessions = await this.db.all(`
            SELECT s.*, c.case_number, c.title as case_title, cl.full_name as client_name, u.full_name as lawyer_name,
            CASE WHEN s.session_date < datetime('now') AND s.status = 'مجدول' THEN 'متأخرة' WHEN s.session_date > datetime('now') THEN 'قادمة' ELSE 'منتهية' END as timeline_status
            FROM sessions s
            LEFT JOIN cases c ON s.case_id = c.id
            LEFT JOIN clients cl ON c.client_id = cl.id
            LEFT JOIN users u ON c.lawyer_id = u.id
            WHERE ${whereClause}
            ORDER BY s.session_date DESC
        `, params);

        const stats = {
            total: sessions.length,
            upcoming: sessions.filter(s => s.timeline_status === 'قادمة').length,
            overdue: sessions.filter(s => s.timeline_status === 'متأخرة').length,
            completed: sessions.filter(s => s.timeline_status === 'منتهية').length,
            byType: {}, byStatus: {}
        };

        sessions.forEach(session => {
            stats.byType[session.session_type] = (stats.byType[session.session_type] || 0) + 1;
            stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;
        });

        return { sessions, stats };
    }

    async generateFinancialReport(filters, officeId) {
        const { startDate, endDate } = filters;
        let dateFilter = '';
        let params = [officeId];

        if (startDate && endDate) {
            dateFilter = 'AND created_at BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        const revenueStats = await this.db.get(`SELECT SUM(amount) as total_invoiced, SUM(paid_amount) as total_collected, COUNT(*) as total_invoices FROM invoices WHERE office_id = ? AND is_active = 1 ${dateFilter}`, params);
        const expenseStats = await this.db.get(`SELECT SUM(amount) as total_expenses FROM expenses WHERE office_id = ? AND is_active = 1 ${dateFilter.replace('created_at', 'expense_date')}`, params);
        const revenueByMonth = await this.db.all(`SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as amount FROM payments WHERE office_id = ? ${dateFilter.replace('created_at', 'payment_date')} GROUP BY month ORDER BY month DESC LIMIT 12`, params);
        const revenueByCaseType = await this.db.all(`SELECT c.case_type, SUM(i.paid_amount) as amount FROM invoices i JOIN cases c ON i.case_id = c.id WHERE i.office_id = ? AND i.is_active = 1 ${dateFilter.replace('created_at', 'i.created_at')} GROUP BY c.case_type`, params);
        const expensesByCategory = await this.db.all(`SELECT category, SUM(amount) as amount FROM expenses WHERE office_id = ? AND is_active = 1 ${dateFilter.replace('created_at', 'expense_date')} GROUP BY category`, params);

        const totalInvoiced = revenueStats.total_invoiced || 0;
        const totalCollected = revenueStats.total_collected || 0;
        const totalExpenses = expenseStats.total_expenses || 0;

        return {
            summary: { totalInvoiced, totalCollected, totalExpenses, netProfit: totalCollected - totalExpenses, outstanding: totalInvoiced - totalCollected, collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced * 100).toFixed(2) : 0 },
            revenue: { byMonth: revenueByMonth, byCaseType: revenueByCaseType },
            expenses: { byCategory: expensesByCategory }
        };
    }

    async getSystemStats(officeId) {
        const stats = await this.db.all(`
            SELECT 'users' as category, role as key, COUNT(*) as value FROM users WHERE is_active = 1 AND office_id = ? GROUP BY role
            UNION ALL
            SELECT 'cases' as category, status as key, COUNT(*) as value FROM cases WHERE is_active = 1 AND office_id = ? GROUP BY status
            UNION ALL
            SELECT 'clients' as category, 'active' as key, COUNT(*) as value FROM clients WHERE is_active = 1 AND office_id = ?
            UNION ALL
            SELECT 'sessions' as category, CASE WHEN session_date > datetime('now') THEN 'upcoming' ELSE 'past' END as key, COUNT(*) as value FROM sessions WHERE is_active = 1 AND office_id = ? GROUP BY key
            UNION ALL
            SELECT 'documents' as category, 'total' as key, COUNT(*) as value FROM documents WHERE is_active = 1 AND office_id = ?
        `, [officeId, officeId, officeId, officeId, officeId]);

        const formattedStats = {};
        stats.forEach(stat => {
            if (!formattedStats[stat.category]) formattedStats[stat.category] = {};
            formattedStats[stat.category][stat.key] = stat.value;
        });
        return formattedStats;
    }
}

module.exports = new ReportService();
