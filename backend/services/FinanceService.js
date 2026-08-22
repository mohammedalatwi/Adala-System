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

        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        // سنة رقم الفاتورة مبنية على issue_date (تاريخ المستند)، لا وقت الإنشاء الفعلي —
        // فاتورة بتاريخ إصدار 2026 تحمل رقم INV-2026-xxxx دائمًا بغض النظر عن متى أُدخلت.
        const year = String(issue_date).slice(0, 4);

        const invoiceResult = await this.db.transaction(async () => {
            // حساب الرقم التسلسلي والتحقق من التصادم يجب أن يحدثا هنا، داخل نفس المنطقة
            // المحمية بطابور transaction() — بنفس منطق نقل قراءة paid_amount بـ
            // recordPayment أدناه — وإلا بقي عرضة لتصادم بين إنشاءين متزامنين لنفس المكتب.
            const maxRow = await this.db.get(
                `SELECT MAX(sequence_number) as maxSeq FROM invoices WHERE office_id = ? AND strftime('%Y', issue_date) = ?`,
                [officeId, year]
            );
            const sequenceNumber = (maxRow.maxSeq || 0) + 1;
            const invoiceNumber = `INV-${year}-${String(sequenceNumber).padStart(4, '0')}`;

            const result = await this.db.run(
                `INSERT INTO invoices (case_id, client_id, invoice_number, sequence_number, issue_date, due_date, amount, notes, created_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [case_id, client_id, invoiceNumber, sequenceNumber, issue_date, due_date, totalAmount, notes, userId, officeId]
            );

            for (const item of items) {
                await this.db.run(
                    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [result.id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
                );
            }

            return { id: result.id, invoice_number: invoiceNumber };
        });

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'invoice',
            entityId: invoiceResult.id,
            description: `إنشاء فاتورة جديدة برقم: ${invoiceResult.invoice_number}`,
            officeId
        });

        return { id: invoiceResult.id, invoice_number: invoiceResult.invoice_number, amount: totalAmount };
    }

    async recordPayment(paymentData, userId, officeId) {
        const { invoice_id, amount, payment_date, payment_method, reference_number, notes } = paymentData;

        const { paymentResult, invoiceNumber, newStatus } = await this.db.transaction(async () => {
            // القراءة والتحقق من المتبقي يجب أن يحدثا هنا، داخل نفس المنطقة المحمية
            // بطابور transaction() — لا قبل استدعائها — وإلا بقيت عرضة لقراءة
            // paid_amount قديمة أثناء انتظار الدور، فيتحول الانهيار المرئي السابق إلى
            // حساب خاطئ صامت.
            const invoice = await this.db.get('SELECT * FROM invoices WHERE id = ? AND office_id = ?', [invoice_id, officeId]);
            if (!invoice) throw new Error('الفاتورة غير موجودة');

            if (invoice.paid_amount + amount > invoice.amount) {
                throw new Error('المبلغ المدفوع يتجاوز قيمة الفاتورة المتبقية');
            }

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

            return { paymentResult, invoiceNumber: invoice.invoice_number, newStatus };
        });

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'payment',
            entityId: paymentResult.id,
            description: `تسجيل دفعة بقيمة ${amount} للفاتورة ${invoiceNumber}`,
            officeId
        });

        return { id: paymentResult.id, amount, newStatus };
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
