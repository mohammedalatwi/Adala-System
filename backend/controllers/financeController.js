const FinanceService = require('../services/FinanceService');
const BaseController = require('../utils/BaseController');
const db = require('../db/database');
const PDFDocument = require('pdfkit');
const PDFHelper = require('../utils/pdfHelper');
const fs = require('fs');

class FinanceController extends BaseController {
    // ==================== الفواتير ====================

    // إنشاء فاتورة جديدة
    createInvoice = this.asyncWrapper(async (req, res) => {
        const result = await FinanceService.createInvoice(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم إنشاء الفاتورة بنجاح');
    });

    // جلب الفواتير
    getAllInvoices = this.asyncWrapper(async (req, res) => {
        const { client_id, status } = req.query;
        let query = `
            SELECT i.*, c.full_name as client_name, cases.title as case_title
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            LEFT JOIN cases ON i.case_id = cases.id
            WHERE i.office_id = ?
        `;
        const params = [req.session.officeId];

        if (client_id) {
            query += ' AND i.client_id = ?';
            params.push(client_id);
        }
        if (status) {
            query += ' AND i.status = ?';
            params.push(status);
        }

        // --- RBAC ---
        const { userRole, userId, clientId: userClientId } = req.session;
        if (userRole === 'client') {
            query += ' AND i.client_id = ?';
            params.push(userClientId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            query += ' AND (cases.lawyer_id = ? OR cases.assistant_lawyer_id = ?)';
            params.push(userId, userId);
        } else if (userRole === 'trainee') {
            query += ' AND 1=0';
        }

        query += ' ORDER BY i.issue_date DESC';

        const invoices = await db.all(query, params);
        this.sendSuccess(res, invoices);
    });

    // تسجيل دفعة
    recordPayment = this.asyncWrapper(async (req, res) => {
        const result = await FinanceService.recordPayment(req.body, req.session.userId, req.session.officeId);
        this.sendSuccess(res, result, 'تم تسجيل الدفعة بنجاح');
    });

    // ==================== المصروفات ====================

    // تسجيل مصروف
    createExpense = this.asyncWrapper(async (req, res) => {
        const result = await FinanceService.createExpense(req.body, req.session.userId, req.session.officeId);
        this.sendCreated(res, result, 'تم تسجيل المصروف بنجاح');
    });

    getAllExpenses = this.asyncWrapper(async (req, res) => {
        let query = `
            SELECT e.*, c.title as case_title, u.full_name as recorded_by_name
            FROM expenses e
            LEFT JOIN cases c ON e.case_id = c.id
            LEFT JOIN users u ON e.recorded_by = u.id
            WHERE e.office_id = ?
        `;
        let params = [req.session.officeId];

        const { userRole, userId, clientId: userClientId } = req.session;
        if (userRole === 'client') {
            query += ' AND c.client_id = ?';
            params.push(userClientId);
        } else if (userRole === 'lawyer' || userRole === 'assistant') {
            query += ' AND (c.lawyer_id = ? OR c.assistant_lawyer_id = ?)';
            params.push(userId, userId);
        }

        query += ' ORDER BY e.expense_date DESC';

        const expenses = await db.all(query, params);
        this.sendSuccess(res, expenses);
    });

    // تحميل الفاتورة كـ PDF
    downloadInvoicePDF = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const officeId = req.session.officeId;

        const invoice = await db.get(`
            SELECT i.*, cl.full_name as client_name, cl.national_id, cl.phone as client_phone
            FROM invoices i
            JOIN clients cl ON i.client_id = cl.id
            WHERE i.id = ? AND i.office_id = ?
        `, [id, officeId]);

        if (!invoice) throw new Error('الفاتورة غير موجودة');

        const office = await db.get('SELECT * FROM offices WHERE id = ?', [officeId]);
        const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

        const doc = new PDFDocument({ margin: 50 });

        // Font handling should ideally be centralized, but keeping consistency for now
        const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
        if (fs.existsSync(fontPath)) doc.font(fontPath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invoice.invoice_number}.pdf`);

        doc.pipe(res);
        PDFHelper.drawInvoice(doc, {
            office: { name: office.name, logo: office.logo_url },
            invoice: {
                invoice_number: invoice.invoice_number,
                issue_date: invoice.issue_date,
                due_date: invoice.due_date,
                amount: invoice.amount,
                paid_amount: invoice.paid_amount,
                status: invoice.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'
            },
            client: {
                full_name: invoice.client_name,
                national_id: invoice.national_id,
                phone: invoice.client_phone
            },
            items: items
        });
        doc.end();
    });
}

module.exports = new FinanceController();
