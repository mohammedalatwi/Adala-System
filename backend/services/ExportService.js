const db = require('../db/database');

class ExportService {
    constructor() {
        this.db = db;
    }

    async getCaseExportData(caseId, officeId) {
        const caseData = await this.db.get(`
            SELECT c.*, cl.full_name as client_name, cl.phone as client_phone, u.full_name as lawyer_name
            FROM cases c
            JOIN clients cl ON c.client_id = cl.id
            JOIN users u ON c.lawyer_id = u.id
            WHERE c.id = ? AND c.office_id = ?
        `, [caseId, officeId]);

        if (!caseData) throw new Error('القضية غير موجودة');

        const sessions = await this.db.all(
            'SELECT * FROM sessions WHERE case_id = ? AND office_id = ? AND is_active = 1 ORDER BY session_date DESC',
            [caseId, officeId]
        );

        return { caseData, sessions };
    }

    async getFinanceExportData(officeId) {
        return await this.db.all(`
            SELECT i.*, cl.full_name as client_name, c.title as case_title
            FROM invoices i
            JOIN clients cl ON i.client_id = cl.id
            LEFT JOIN cases c ON i.case_id = c.id
            WHERE i.status != 'paid' AND i.office_id = ?
            ORDER BY i.due_date ASC
        `, [officeId]);
    }

    async getCasesForExcel(officeId) {
        return await this.db.all(`
            SELECT c.*, cl.full_name as client_name, u.full_name as lawyer_name 
            FROM cases c 
            JOIN clients cl ON c.client_id = cl.id
            JOIN users u ON c.lawyer_id = u.id
            WHERE c.office_id = ?
        `, [officeId]);
    }
}

module.exports = new ExportService();
