const db = require('../db/database');

class DashboardService {
    constructor() {
        this.db = db;
    }

    async getDashboardStats(userId, userRole, officeId) {
        let query, params;
        if (userRole === 'admin') {
            query = `
                SELECT 
                    (SELECT COUNT(*) FROM cases WHERE is_active = 1 AND office_id = ?) as total_cases,
                    (SELECT COUNT(*) FROM clients WHERE is_active = 1 AND office_id = ?) as total_clients,
                    (SELECT COUNT(*) FROM sessions WHERE session_date > datetime('now') AND status = 'مجدول' AND office_id = ?) as upcoming_sessions,
                    (SELECT COUNT(*) FROM documents WHERE is_active = 1 AND office_id = ?) as total_documents,
                    (SELECT COUNT(*) FROM cases WHERE status = 'جديد' AND is_active = 1 AND office_id = ?) as new_cases,
                    (SELECT COUNT(*) FROM cases WHERE status = 'قيد الدراسة' AND is_active = 1 AND office_id = ?) as in_progress_cases,
                    (SELECT COUNT(*) FROM cases WHERE status = 'منتهي' AND is_active = 1 AND office_id = ?) as completed_cases,
                    (SELECT COUNT(*) FROM users WHERE is_active = 1 AND role = 'lawyer' AND office_id = ?) as total_lawyers,
                    (SELECT SUM(amount) FROM invoices WHERE office_id = ?) as total_invoiced,
                    (SELECT SUM(paid_amount) FROM invoices WHERE office_id = ?) as total_paid
            `;
            params = Array(10).fill(officeId);
        } else {
            // المتدرب يُسنَد له عبر assistant_lawyer_id، أما المحامي فعبر lawyer_id
            const ownerColumn = userRole === 'trainee' ? 'assistant_lawyer_id' : 'lawyer_id';
            query = `
                SELECT
                    (SELECT COUNT(*) FROM cases WHERE ${ownerColumn} = ? AND is_active = 1 AND office_id = ?) as total_cases,
                    (SELECT COUNT(*) FROM clients WHERE created_by = ? AND is_active = 1 AND office_id = ?) as total_clients,
                    (SELECT COUNT(*) FROM sessions s JOIN cases c ON s.case_id = c.id WHERE s.session_date > datetime('now') AND s.status = 'مجدول' AND c.${ownerColumn} = ? AND s.office_id = ?) as upcoming_sessions,
                    (SELECT COUNT(*) FROM documents WHERE uploaded_by = ? AND is_active = 1 AND office_id = ?) as total_documents,
                    (SELECT COUNT(*) FROM cases WHERE ${ownerColumn} = ? AND status = 'جديد' AND is_active = 1 AND office_id = ?) as new_cases,
                    (SELECT COUNT(*) FROM cases WHERE ${ownerColumn} = ? AND status = 'قيد الدراسة' AND is_active = 1 AND office_id = ?) as in_progress_cases,
                    (SELECT COUNT(*) FROM cases WHERE ${ownerColumn} = ? AND status = 'منتهي' AND is_active = 1 AND office_id = ?) as completed_cases,
                    (SELECT SUM(amount) FROM invoices i JOIN cases c ON i.case_id = c.id WHERE c.${ownerColumn} = ? AND i.office_id = ? AND c.is_active = 1) as total_invoiced,
                    (SELECT SUM(paid_amount) FROM invoices i JOIN cases c ON i.case_id = c.id WHERE c.${ownerColumn} = ? AND i.office_id = ? AND c.is_active = 1) as total_paid
            `;
            params = [userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId, userId, officeId];
        }
        return await this.db.get(query, params) || {};
    }

    async getUpcomingSessions(userId, userRole, officeId) {
        let query, params;
        if (userRole === 'admin') {
            query = `SELECT s.*, c.case_number, c.title as case_title, cl.full_name as client_name, u.full_name as lawyer_name FROM sessions s LEFT JOIN cases c ON s.case_id = c.id LEFT JOIN clients cl ON c.client_id = cl.id LEFT JOIN users u ON c.lawyer_id = u.id WHERE s.session_date > datetime('now') AND s.status = 'مجدول' AND s.office_id = ? ORDER BY s.session_date ASC LIMIT 10`;
            params = [officeId];
        } else {
            const ownerColumn = userRole === 'trainee' ? 'assistant_lawyer_id' : 'lawyer_id';
            query = `SELECT s.*, c.case_number, c.title as case_title, cl.full_name as client_name, u.full_name as lawyer_name FROM sessions s LEFT JOIN cases c ON s.case_id = c.id LEFT JOIN clients cl ON c.client_id = cl.id LEFT JOIN users u ON c.lawyer_id = u.id WHERE s.session_date > datetime('now') AND s.status = 'مجدول' AND c.${ownerColumn} = ? AND s.office_id = ? ORDER BY s.session_date ASC LIMIT 10`;
            params = [userId, officeId];
        }
        return await this.db.all(query, params) || [];
    }

    async getRecentCases(userId, userRole, officeId) {
        let query, params;
        if (userRole === 'admin') {
            query = `SELECT c.*, cl.full_name as client_name, u.full_name as lawyer_name FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id LEFT JOIN users u ON c.lawyer_id = u.id WHERE c.is_active = 1 AND c.office_id = ? ORDER BY c.created_at DESC LIMIT 10`;
            params = [officeId];
        } else {
            const ownerColumn = userRole === 'trainee' ? 'assistant_lawyer_id' : 'lawyer_id';
            query = `SELECT c.*, cl.full_name as client_name, u.full_name as lawyer_name FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id LEFT JOIN users u ON c.lawyer_id = u.id WHERE c.is_active = 1 AND c.${ownerColumn} = ? AND c.office_id = ? ORDER BY c.created_at DESC LIMIT 10`;
            params = [userId, officeId];
        }
        return await this.db.all(query, params) || [];
    }

    async getRecentTasks(userId, userRole, officeId) {
        let query, params;
        if (userRole === 'admin') {
            query = `SELECT t.*, c.title as case_title FROM tasks t LEFT JOIN cases c ON t.case_id = c.id WHERE t.status != 'مكتمل' AND t.office_id = ? ORDER BY t.due_date ASC, t.priority DESC LIMIT 5`;
            params = [officeId];
        } else {
            query = `SELECT t.*, c.title as case_title FROM tasks t LEFT JOIN cases c ON t.case_id = c.id WHERE t.assigned_to = ? AND t.status != 'مكتمل' AND t.office_id = ? ORDER BY t.due_date ASC, t.priority DESC LIMIT 5`;
            params = [userId, officeId];
        }
        return await this.db.all(query, params) || [];
    }

    async getNotifications(userId, officeId, onlyUnread = false) {
        let sql = `SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? AND office_id = ?`;
        if (onlyUnread) sql += ` AND is_read = 0`;
        sql += ` ORDER BY created_at DESC LIMIT 20`;
        return await this.db.all(sql, [userId, officeId]);
    }

    async getRecentActivities(userId, userRole, officeId) {
        let query, params;
        if (userRole === 'admin') {
            query = `SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.office_id = ? ORDER BY a.created_at DESC LIMIT 20`;
            params = [officeId];
        } else {
            query = `SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.user_id = ? AND a.office_id = ? ORDER BY a.created_at DESC LIMIT 20`;
            params = [userId, officeId];
        }
        return await this.db.all(query, params);
    }
}

module.exports = new DashboardService();
