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
        const tabInv = document.getElementById('tabInvoices');
        const tabExp = document.getElementById('tabExpenses');
        const viewInv = document.getElementById('invoicesView');
        const viewExp = document.getElementById('expensesView');

        if (tab === 'invoices') {
            viewInv.style.display = 'block';
            viewExp.style.display = 'none';

            tabInv.className = 'btn btn-sm active';
            tabInv.style.background = 'var(--brand-primary)';
            tabInv.style.color = 'white';

            tabExp.className = 'btn btn-sm';
            tabExp.style.background = 'transparent';
            tabExp.style.color = 'var(--text-muted)';
        } else {
            viewInv.style.display = 'none';
            viewExp.style.display = 'block';

            tabExp.className = 'btn btn-sm active';
            tabExp.style.background = 'var(--brand-primary)';
            tabExp.style.color = 'white';

            tabInv.className = 'btn btn-sm';
            tabInv.style.background = 'transparent';
            tabInv.style.color = 'var(--text-muted)';

            this.loadExpenses();
        }
    }

    static async loadExpenses() {
        const tbody = document.getElementById('expensesList');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> تحميل...</td></tr>';

        try {
            const result = await API.get('/finance/expenses');
            if (result.success) {
                // Backend returns { expenses, pagination }
                const expenses = result.data.expenses || result.data;
                this.renderExpenses(expenses);
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
            // جلب الفواتير
            const result = await API.get('/finance/invoices');
            if (result.success) {
                // Backend returns { invoices, pagination }
                const invoices = result.data.invoices || result.data;
                this.renderInvoices(invoices);
            }

            // جلب الخلاصة المالية المتقدمة
            this.loadFinancialSummary();

        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">فشل تحميل البيانات</td></tr>';
        }
    }

    static async loadFinancialSummary() {
        try {
            const result = await API.get('/api/reports/financial');
            if (result.success && result.data) {
                const s = result.data.summary;
                document.getElementById('statsTotal').textContent = Number(s.totalInvoiced).toFixed(2) + ' ر.س';
                document.getElementById('statsPaid').textContent = Number(s.totalCollected).toFixed(2) + ' ر.س';
                document.getElementById('statsExpenses').textContent = Number(s.totalExpenses).toFixed(2) + ' ر.س';
                document.getElementById('statsProfit').textContent = Number(s.netProfit).toFixed(2) + ' ر.س';
                document.getElementById('statsDue').textContent = Number(s.outstanding).toFixed(2) + ' ر.س';
            }
        } catch (error) {
            console.error('Error loading financial summary:', error);
        }
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
                        <div style="display:flex; gap:0.3rem;">
                            <button class="btn btn-sm btn-outline-primary" style="padding:2px 8px;" onclick="FinanceManager.openPaymentModal(${inv.id}, ${due})">
                                <i class="fas fa-dollar-sign"></i> دفع
                            </button>
                            <button class="btn btn-sm btn-outline" style="padding:2px 8px; color:var(--brand-primary);" onclick="FinanceManager.downloadInvoice(${inv.id})">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    static async downloadInvoice(invId) {
        try {
            Utils.showMessage('جاري تجهيز الفاتورة...', 'info');
            // استخدام الرابط المباشر للتحميل
            window.location.href = `/api/finance/invoices/${invId}/download`;
        } catch (error) {
            Utils.showMessage('فشل تحميل الفاتورة', 'error');
        }
    }

    static getStatusBadge(status) {
        const map = {
            'unpaid': { text: 'غير مدفوع', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)' },
            'paid': { text: 'مدفوع بالكامل', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)' },
            'partially_paid': { text: 'مدفوع جزئياً', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' },
            'overdue': { text: 'متأخر جداً', color: '#7f1d1d', bg: 'rgba(127, 29, 29, 0.1)' }
        };
        const s = map[status] || { text: status, color: '#666', bg: '#eee' };
        return `<span style="background:${s.bg}; color:${s.color}; padding:4px 10px; border-radius:8px; font-size:0.75rem; font-weight:800; border:1px solid ${s.color}22;">${s.text}</span>`;
    }

    static async loadClients() {
        const res = await API.get('/clients');
        if (res.success) {
            const clients = res.data.clients || res.data;
            document.getElementById('invClient').innerHTML = '<option value="">اختر العميل</option>' +
                clients.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
        }
    }

    static async loadCases() {
        const res = await API.get('/cases?limit=100');
        if (res.success) {
            const cases = res.data.cases || res.data;
            document.getElementById('invCase').innerHTML = '<option value="">(اختياري)</option>' +
                cases.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
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
