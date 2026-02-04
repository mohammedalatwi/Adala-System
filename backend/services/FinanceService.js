const db = require('../db/database');
const ActivityService = require('./ActivityService');

class FinanceService {
    constructor() {
        this.db = db;
    }

    async createInvoice(invoiceData, userId, officeId) {
        const {
            case_id,
            client_id,
            issue_date,
            due_date,
            notes,
            items
        } = invoiceData;

        if (!items || items.length === 0) {
            throw new Error('يجب إضافة بند واحد على الأقل للفاتورة');
        }

        const invoice_number = 'INV-' + Date.now();
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        await this.db.run('BEGIN TRANSACTION');

        try {
            const invoiceResult = await this.db.run(
                `INSERT INTO invoices (case_id, client_id, invoice_number, issue_date, due_date, amount, notes, created_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [case_id, client_id, invoice_number, issue_date, due_date, totalAmount, notes, userId, officeId]
            );

            for (const item of items) {
                await this.db.run(
                    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [invoiceResult.id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
                );
            }

            await this.db.run('COMMIT');

            await ActivityService.logActivity({
                userId,
                actionType: 'create',
                entityType: 'invoice',
                entityId: invoiceResult.id,
                description: `إنشاء فاتورة جديدة برقم: ${invoice_number}`,
                officeId
            });

            return { id: invoiceResult.id, invoice_number, amount: totalAmount };
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
    }

    async recordPayment(paymentData, userId, officeId) {
        const { invoice_id, amount, payment_date, payment_method, reference_number, notes } = paymentData;

        const invoice = await this.db.get('SELECT * FROM invoices WHERE id = ? AND office_id = ?', [invoice_id, officeId]);
        if (!invoice) throw new Error('الفاتورة غير موجودة');

        if (invoice.paid_amount + amount > invoice.amount) {
            throw new Error('المبلغ المدفوع يتجاوز قيمة الفاتورة المتبقية');
        }

        await this.db.run('BEGIN TRANSACTION');

        try {
            const paymentResult = await this.db.run(
                `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes, recorded_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [invoice_id, amount, payment_date, payment_method, reference_number, notes, userId, officeId]
            );

            const newPaidAmount = invoice.paid_amount + amount;
            let newStatus = invoice.status;
            if (newPaidAmount >= invoice.amount) newStatus = 'paid';
            else if (newPaidAmount > 0) newStatus = 'partially_paid';

            await this.db.run(
                'UPDATE invoices SET paid_amount = ?, status = ?, updated_at = datetime("now") WHERE id = ? AND office_id = ?',
                [newPaidAmount, newStatus, invoice_id, officeId]
            );

            await this.db.run('COMMIT');

            await ActivityService.logActivity({
                userId,
                actionType: 'create',
                entityType: 'payment',
                entityId: paymentResult.id,
                description: `تسجيل دفعة بقيمة ${amount} للفاتورة ${invoice.invoice_number}`,
                officeId
            });

            return { id: paymentResult.id, amount, newStatus };
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
    }

    async createExpense(expenseData, userId, officeId) {
        const { case_id, title, amount, expense_date, category, notes, is_billable } = expenseData;

        const result = await this.db.run(
            `INSERT INTO expenses (case_id, title, amount, expense_date, category, notes, is_billable, recorded_by, office_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [case_id, title, amount, expense_date, category, notes, is_billable ? 1 : 0, userId, officeId]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'expense',
            entityId: result.id,
            description: `تسجيل مصروف: ${title} بقيمة ${amount}`,
            officeId
        });

        return { id: result.id };
    }
}

module.exports = new FinanceService();
