const ClientService = require('../services/ClientService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class ClientController extends BaseController {
    // ✅ إنشاء عميل جديد
    createClient = this.asyncWrapper(async (req, res) => {
        const result = await ClientService.createClient(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم إنشاء العميل بنجاح');
    });

    // ✅ جلب جميع العملاء
    getAllClients = this.asyncWrapper(async (req, res) => {
        const { page = 1, limit = 10, search } = req.query;
        const officeId = req.session.officeId;
        const offset = (page - 1) * limit;

        let whereConditions = ['c.is_active = 1', 'c.office_id = ?'];
        let params = [officeId];

        if (search) {
            whereConditions.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.national_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.join(' AND ');

        const clients = await db.all(`
            SELECT c.*, u.full_name as created_by_name, (SELECT COUNT(*) FROM cases WHERE client_id = c.id) as cases_count
            FROM clients c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE ${whereClause}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const totalResult = await db.get(`SELECT COUNT(*) as total FROM clients c WHERE ${whereClause}`, params);

        this.sendSuccess(res, {
            clients,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalResult.total / limit)
            }
        });
    });

    // ✅ جلب عميل محدد مع تفاصيله الكاملة
    getClientById = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const client = await db.get(`
            SELECT c.*, u.full_name as created_by_name
            FROM clients c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.id = ? AND c.office_id = ? AND c.is_active = 1
        `, [id, officeId]);

        if (!client) throw new Error('العميل غير موجود');

        // جلب القضايا
        const cases = await db.all('SELECT * FROM cases WHERE client_id = ? AND office_id = ? ORDER BY created_at DESC', [id, officeId]);
        const caseIds = cases.map(c => c.id);

        let sessions = [];
        let documents = [];
        let transactions = [];

        if (caseIds.length > 0) {
            const placeholders = caseIds.map(() => '?').join(',');

            // جلب الجلسات المرتبطة بقضايا العميل
            sessions = await db.all(`
                SELECT s.*, c.title as case_title, c.case_number 
                FROM sessions s
                JOIN cases c ON s.case_id = c.id
                WHERE s.case_id IN (${placeholders}) AND s.office_id = ?
                ORDER BY s.session_date DESC
            `, [...caseIds, officeId]);

            // جلب المستندات المرتبطة بقضايا العميل
            documents = await db.all(`
                SELECT d.*, c.title as case_title
                FROM documents d
                LEFT JOIN cases c ON d.case_id = c.id
                WHERE d.case_id IN (${placeholders}) AND d.office_id = ?
                ORDER BY d.uploaded_at DESC
            `, [...caseIds, officeId]);
        }

        // جلب المعاملات المالية المرتبطة بالعميل مباشرة (المدفوعات)
        transactions = await db.all(`
            SELECT p.id, p.amount, p.payment_date as transaction_date, p.payment_method, 
                   p.reference_number as receipt_number, 'income' as type, c.title as case_title
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN cases c ON i.case_id = c.id
            WHERE i.client_id = ? AND p.office_id = ?
            ORDER BY p.payment_date DESC
        `, [id, officeId]);

        this.sendSuccess(res, {
            client,
            cases,
            sessions,
            documents,
            transactions
        });
    });

    // ✅ تحديث عميل
    updateClient = this.asyncWrapper(async (req, res) => {
        await ClientService.updateClient(req.params.id, req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم تحديث العميل بنجاح');
    });

    // ✅ حذف عميل
    deleteClient = this.asyncWrapper(async (req, res) => {
        await ClientService.deleteClient(req.params.id, req.session.userId, req.session.officeId);
        this.sendSuccess(res, null, 'تم حذف العميل بنجاح');
    });

    // ✅ إحصائيات العملاء
    getClientStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const overview = await db.get(`
            SELECT 
                COUNT(*) as total_clients,
                COUNT(CASE WHEN date('now') - date(created_at) <= 30 THEN 1 END) as new_this_month,
                (SELECT COUNT(*) FROM cases WHERE office_id = ?) as total_cases,
                (SELECT COUNT(DISTINCT client_id) FROM cases WHERE office_id = ?) as clients_with_cases
            FROM clients 
            WHERE is_active = 1 AND office_id = ?
        `, [officeId, officeId, officeId]);

        const byOccupation = await db.all(`
            SELECT occupation, COUNT(*) as count
            FROM clients 
            WHERE is_active = 1 AND occupation IS NOT NULL AND office_id = ?
            GROUP BY occupation
            ORDER BY count DESC
            LIMIT 10
        `, [officeId]);

        this.sendSuccess(res, { overview, byOccupation });
    });
}

module.exports = new ClientController();