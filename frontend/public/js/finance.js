/**
 * finance.js - V3.0 Finance Manager
 */
class FinanceManager {
    static async init() {
        await this.checkAuth();
        this.setupEventListeners();

        await Promise.all([
            this.loadClients(),
            this.loadCases()
        ]);

        this.loadInvoices();

        console.log('✅ Finance Manager Ready');
    }

    static async checkAuth() {
        const auth = await API.get('/auth/status');
        if (!auth.authenticated) {
            window.location.href = '/login';
        } else {
            if (auth.user) {
                document.getElementById('userName').textContent = auth.user.full_name;
                document.getElementById('userRole').textContent = auth.user.role;
                document.getElementById('userAvatar').textContent = auth.user.full_name.charAt(0).toUpperCase();
            }
        }
    }

    static setupEventListeners() {
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await API.post('/auth/logout');
            window.location.href = '/login';
        });

        document.getElementById('searchInput').addEventListener('input',
            Utils.debounce(() => this.loadInvoices(), 500)
        );

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Default dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('invIssueDate').value = today;
        document.getElementById('invDueDate').value = today;
    }

    static switchTab(tab) {
        if (tab === 'invoices') {
            document.getElementById('invoicesView').style.display = 'block';
            document.getElementById('expensesView').style.display = 'none';
            document.getElementById('tabInvoices').style.color = 'var(--brand-primary)';
            document.getElementById('tabInvoices').style.borderBottom = '2px solid var(--brand-primary)';
            document.getElementById('tabExpenses').style.color = 'var(--text-muted)';
            document.getElementById('tabExpenses').style.borderBottom = 'none';
        } else {
            document.getElementById('invoicesView').style.display = 'none';
            document.getElementById('expensesView').style.display = 'block';
            document.getElementById('tabExpenses').style.color = 'var(--brand-primary)';
            document.getElementById('tabExpenses').style.borderBottom = '2px solid var(--brand-primary)';
            document.getElementById('tabInvoices').style.color = 'var(--text-muted)';
            document.getElementById('tabInvoices').style.borderBottom = 'none';
            this.loadExpenses();
        }
    }

    static async loadExpenses() {
        const tbody = document.getElementById('expensesList');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> تحميل...</td></tr>';

        try {
            const result = await API.get('/finance/expenses');
            if (result.success) {
                this.renderExpenses(result.data);
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">فشل تحميل المصروفات</td></tr>';
        }
    }

    static renderExpenses(expenses) {
        const tbody = document.getElementById('expensesList');
        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem;">لا توجد مصروفات مسجلة</td></tr>';
            return;
        }

        tbody.innerHTML = expenses.map(exp => `
            <tr>
                <td style="font-weight:bold;">${exp.title}</td>
                <td><span class="badge" style="background:var(--bg-body); color:var(--text-muted); border:1px solid var(--border-color);">${exp.category || '-'}</span></td>
                <td>${new Date(exp.expense_date).toLocaleDateString('ar-SA')}</td>
                <td style="font-weight:bold;">${Number(exp.amount).toFixed(2)}</td>
                <td>${exp.is_billable ? '<i class="fas fa-check-circle text-success" title="نعم"></i>' : '<i class="fas fa-times-circle text-muted" title="لا"></i>'}</td>
                <td>${exp.case_title || '<span class="text-muted">عام</span>'}</td>
                <td><div style="font-size:0.85rem;">${exp.recorded_by_name || '-'}</div></td>
            </tr>
        `).join('');
    }

    static openExpenseModal() {
        document.getElementById('expenseForm').reset();
        document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('expenseModal').style.display = 'flex';
        // Fill cases dropdown
        this.loadCasesForExpenses();
    }

    static async loadCasesForExpenses() {
        const res = await API.get('/cases?limit=100');
        if (res.success) {
            document.getElementById('expCase').innerHTML = '<option value="">عام</option>' +
                res.data.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    }

    static closeExpenseModal() {
        document.getElementById('expenseModal').style.display = 'none';
    }

    static async saveExpense() {
        const data = {
            title: document.getElementById('expTitle').value,
            amount: parseFloat(document.getElementById('expAmount').value),
            expense_date: document.getElementById('expDate').value,
            category: document.getElementById('expCategory').value,
            case_id: document.getElementById('expCase').value,
            notes: document.getElementById('expNotes').value,
            is_billable: document.getElementById('expBillable').checked
        };

        if (!data.title || !data.amount || !data.expense_date) {
            Utils.showMessage('يرجى تعبئة الحقول المطلوبة', 'error');
            return;
        }

        try {
            const result = await API.post('/finance/expenses', data);
            if (result.success) {
                Utils.showMessage('تم تسجيل المصروف بنجاح', 'success');
                this.closeExpenseModal();
                this.loadExpenses();
            }
        } catch (error) { }
    }

    static async loadInvoices() {
        const tbody = document.getElementById('invoicesList');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> تحميل...</td></tr>';

        try {
            const result = await API.get('/finance/invoices');
            if (result.success) {
                this.renderInvoices(result.data);
                this.calculateStats(result.data);
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">فشل تحميل البيانات</td></tr>';
        }
    }

    static calculateStats(invoices) {
        let total = 0;
        let paid = 0;

        invoices.forEach(inv => {
            total += parseFloat(inv.amount || 0);
            paid += parseFloat(inv.paid_amount || 0);
        });

        document.getElementById('statsTotal').textContent = total.toFixed(2) + ' ر.س';
        document.getElementById('statsPaid').textContent = paid.toFixed(2) + ' ر.س';
        document.getElementById('statsDue').textContent = (total - paid).toFixed(2) + ' ر.س';
    }

    static renderInvoices(invoices) {
        const tbody = document.getElementById('invoicesList');

        if (!invoices || invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;">لا توجد فواتير</td></tr>';
            return;
        }

        tbody.innerHTML = invoices.map(inv => {
            const due = parseFloat(inv.amount) - parseFloat(inv.paid_amount);
            return `
                <tr>
                    <td style="font-weight:bold;">${inv.invoice_number}</td>
                    <td>${inv.client_name || '-'}</td>
                    <td>${new Date(inv.issue_date).toLocaleDateString('ar-SA')}</td>
                    <td>${Number(inv.amount).toFixed(2)}</td>
                    <td class="text-success">${Number(inv.paid_amount).toFixed(2)}</td>
                    <td class="text-danger" style="font-weight:bold;">${due.toFixed(2)}</td>
                    <td>${this.getStatusBadge(inv.status)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" style="padding:2px 8px;" onclick="FinanceManager.openPaymentModal(${inv.id}, ${due})">
                            <i class="fas fa-dollar-sign"></i> دفع
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    static getStatusBadge(status) {
        const map = {
            'unpaid': { text: 'غير مدفوع', color: '#ef4444', bg: '#fee2e2' },
            'paid': { text: 'مدفوع', color: '#10b981', bg: '#d1fae5' },
            'partially_paid': { text: 'جزئي', color: '#f59e0b', bg: '#fef3c7' },
            'overdue': { text: 'متأخر', color: '#7f1d1d', bg: '#fca5a5' }
        };
        const s = map[status] || { text: status, color: '#666', bg: '#eee' };
        return `<span style="background:${s.bg}; color:${s.color}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${s.text}</span>`;
    }

    static async loadClients() {
        const res = await API.get('/clients');
        if (res.success) {
            document.getElementById('invClient').innerHTML = '<option value="">اختر العميل</option>' +
                res.data.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
        }
    }

    static async loadCases() {
        const res = await API.get('/cases?limit=100');
        if (res.success) {
            document.getElementById('invCase').innerHTML = '<option value="">(اختياري)</option>' +
                res.data.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    }

    // Modal & Form Logic
    static openInvoiceModal() {
        document.getElementById('invoiceForm').reset();
        document.getElementById('invItems').innerHTML = '';
        this.addItemRow(); // Add one default row
        document.getElementById('invoiceModal').style.display = 'flex';
        this.calculateTotal();
    }

    static closeInvoiceModal() {
        document.getElementById('invoiceModal').style.display = 'none';
    }

    static addItemRow() {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style = 'display:grid; grid-template-columns: 3fr 1fr 1fr auto; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
        div.innerHTML = `
            <input type="text" class="form-control item-desc" placeholder="الوصف" required>
            <input type="number" class="form-control item-qty" placeholder="الكمية" value="1" min="1" onchange="FinanceManager.calculateTotal()">
            <input type="number" class="form-control item-price" placeholder="السعر" step="0.01" onchange="FinanceManager.calculateTotal()">
            <button type="button" class="btn btn-sm btn-outline" style="color:var(--danger);" onclick="this.parentElement.remove(); FinanceManager.calculateTotal()"><i class="fas fa-trash"></i></button>
        `;
        document.getElementById('invItems').appendChild(div);
    }

    static calculateTotal() {
        let total = 0;
        document.querySelectorAll('.item-row').forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            total += qty * price;
        });
        document.getElementById('invTotal').textContent = total.toFixed(2);
    }

    static async saveInvoice() {
        const items = [];
        let valid = true;

        document.querySelectorAll('.item-row').forEach(row => {
            const desc = row.querySelector('.item-desc').value;
            const qty = row.querySelector('.item-qty').value;
            const price = row.querySelector('.item-price').value;

            if (!desc || !qty || !price) valid = false;

            items.push({
                description: desc,
                quantity: parseFloat(qty),
                unit_price: parseFloat(price)
            });
        });

        const data = {
            client_id: document.getElementById('invClient').value,
            case_id: document.getElementById('invCase').value,
            issue_date: document.getElementById('invIssueDate').value,
            due_date: document.getElementById('invDueDate').value,
            items: items
        };

        if (!data.client_id || items.length === 0 || !valid) {
            Utils.showMessage('يرجى تعبئة جميع الحقول المطلوبة', 'error');
            return;
        }

        try {
            const result = await API.post('/finance/invoices', data);
            if (result.success) {
                Utils.showMessage('تم إنشاء الفاتورة بنجاح', 'success');
                this.closeInvoiceModal();
                this.loadInvoices();
            }
        } catch (error) {
            // handled
        }
    }

    // Payments
    static openPaymentModal(invId, dueAmount) {
        if (dueAmount <= 0) {
            Utils.showMessage('هذه الفاتورة مدفوعة بالكامل', 'info');
            return;
        }
        document.getElementById('payInvoiceId').value = invId;
        document.getElementById('payAmount').value = dueAmount;
        document.getElementById('paymentModal').style.display = 'flex';
    }

    static async submitPayment() {
        const invId = document.getElementById('payInvoiceId').value;
        const amount = document.getElementById('payAmount').value;
        const notes = document.getElementById('payNotes').value;

        if (!amount || amount <= 0) return;

        try {
            const result = await API.post('/finance/payments', {
                invoice_id: Number(invId),
                amount: parseFloat(amount),
                notes: notes
            });

            if (result.success) {
                Utils.showMessage('تم تسجيل الدفعة بنجاح', 'success');
                document.getElementById('paymentModal').style.display = 'none';
                this.loadInvoices();
            }
        } catch (error) {
            // handled
        }
    }
}

window.FinanceManager = FinanceManager;
document.addEventListener('DOMContentLoaded', () => FinanceManager.init());
