const db = require('../db/database');

class FinanceController {
    // ==================== الفواتير ====================

    // إنشاء فاتورة جديدة
    createInvoice = async (req, res) => {
        try {
            const {
                case_id,
                client_id,
                issue_date,
                due_date,
                notes,
                items
            } = req.body;

            if (!items || items.length === 0) {
                return res.status(400).json({ success: false, message: 'يجب إضافة بند واحد على الأقل للفاتورة' });
            }

            // توليد رقم الفاتورة
            const invoice_number = 'INV-' + Date.now();

            // حساب الإجمالي
            const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

            // بدء Transaction
            await db.run('BEGIN TRANSACTION');

            // إنشاء الفاتورة
            const invoiceResult = await db.run(
                `INSERT INTO invoices (case_id, client_id, invoice_number, issue_date, due_date, amount, notes, created_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [case_id, client_id, invoice_number, issue_date, due_date, totalAmount, notes, req.session.userId, req.session.officeId]
            );

            // إضافة البنود
            for (const item of items) {
                await db.run(
                    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
                     VALUES (?, ?, ?, ?, ?)`,
                    [invoiceResult.id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
                );
            }

            await db.run('COMMIT');

            res.status(201).json({
                success: true,
                message: 'تم إنشاء الفاتورة بنجاح',
                data: { id: invoiceResult.id, invoice_number, amount: totalAmount }
            });

        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Create invoice error:', error);
            res.status(500).json({ success: false, message: 'خطأ في إنشاء الفاتورة' });
        }
    };

    // جلب الفواتير
    getAllInvoices = async (req, res) => {
        try {
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

            // --- RBAC Implementation ---
            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            if (userRole === 'client') {
                query += ' AND i.client_id = ?';
                params.push(userClientId);
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                query += ' AND (cases.lawyer_id = ? OR cases.assistant_lawyer_id = ?)';
                params.push(userId, userId);
            } else if (userRole === 'trainee') {
                // المتدرب لا يرى البيانات المالية
                query += ' AND 1=0';
            }
            // ---------------------------

            query += ' ORDER BY i.issue_date DESC';

            const invoices = await db.all(query, params);
            res.json({ success: true, data: invoices });

        } catch (error) {
            console.error('Get invoices error:', error);
            res.status(500).json({ success: false, message: 'خطأ في جلب الفواتير' });
        }
    };

    // تسجيل دفعة
    recordPayment = async (req, res) => {
        try {
            const { invoice_id, amount, payment_date, payment_method, reference_number, notes } = req.body;

            const invoice = await db.get('SELECT * FROM invoices WHERE id = ? AND office_id = ?', [invoice_id, req.session.officeId]);
            if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

            if (invoice.paid_amount + amount > invoice.amount) {
                return res.status(400).json({ success: false, message: 'المبلغ المدفوع يتجاوز قيمة الفاتورة المتبقية' });
            }

            await db.run('BEGIN TRANSACTION');

            // تسجيل الدفعة
            await db.run(
                `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes, recorded_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [invoice_id, amount, payment_date, payment_method, reference_number, notes, req.session.userId, req.session.officeId]
            );

            // تحديث الفاتورة
            const newPaidAmount = invoice.paid_amount + amount;
            let newStatus = invoice.status;
            if (newPaidAmount >= invoice.amount) newStatus = 'paid';
            else if (newPaidAmount > 0) newStatus = 'partially_paid';

            await db.run(
                'UPDATE invoices SET paid_amount = ?, status = ?, updated_at = datetime("now") WHERE id = ? AND office_id = ?',
                [newPaidAmount, newStatus, invoice_id, req.session.officeId]
            );

            await db.run('COMMIT');

            res.json({ success: true, message: 'تم تسجيل الدفعة بنجاح' });

        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Record payment error:', error);
            res.status(500).json({ success: false, message: 'خطأ في تسجيل الدفعة' });
        }
    };

    // ==================== المصروفات ====================

    // تسجيل مصروف
    createExpense = async (req, res) => {
        try {
            const { case_id, title, amount, expense_date, category, notes, is_billable } = req.body;

            const result = await db.run(
                `INSERT INTO expenses (case_id, title, amount, expense_date, category, notes, is_billable, recorded_by, office_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [case_id, title, amount, expense_date, category, notes, is_billable ? 1 : 0, req.session.userId, req.session.officeId]
            );

            res.status(201).json({
                success: true,
                message: 'تم تسجيل المصروف بنجاح',
                data: { id: result.id }
            });

        } catch (error) {
            console.error('Create expense error:', error);
            res.status(500).json({ success: false, message: 'خطأ في تسجيل المصروف' });
        }
    };

    getAllExpenses = async (req, res) => {
        try {
            // Refactor for RBAC
            let query = `
                SELECT e.*, c.title as case_title, u.full_name as recorded_by_name
                FROM expenses e
                LEFT JOIN cases c ON e.case_id = c.id
                LEFT JOIN users u ON e.recorded_by = u.id
                WHERE e.office_id = ?
                `;
            let params = [req.session.officeId];

            const userRole = req.session.userRole;
            const userId = req.session.userId;
            const userClientId = req.session.clientId;

            if (userRole === 'client') {
                query += ' AND c.client_id = ?';
                params.push(userClientId);
            } else if (userRole === 'lawyer' || userRole === 'assistant') {
                query += ' AND (c.lawyer_id = ? OR c.assistant_lawyer_id = ?)';
                params.push(userId, userId);
            }

            query += ' ORDER BY e.expense_date DESC';

            const expenses = await db.all(query, params);
            res.json({ success: true, data: expenses });
        } catch (error) {
            res.status(500).json({ success: false, message: 'خطأ في جلب المصروفات' });
        }
    };
}

module.exports = new FinanceController();
