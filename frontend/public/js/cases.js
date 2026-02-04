/**
 * cases.js - V2.0 Cases Manager
 */
class CasesManager {
    static async init() {
        // Init UI
        await this.checkAuth();
        this.setupEventListeners();

        // Load Data
        await Promise.all([
            this.loadCases(),
            this.loadClients() // For the modal dropdown
        ]);
        // loadLawyers() removed

        console.log('✅ Cases Manager Ready');
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
            Utils.debounce(() => this.loadCases(), 500)
        );

        // Click outside modal
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('caseModal')) {
                this.closeCaseModal();
            }
        });
    }

    static async loadCases() {
        try {
            const search = document.getElementById('searchInput').value;
            const status = document.getElementById('statusFilter').value;
            const type = document.getElementById('typeFilter').value;

            const params = { search, status, type };
            // Remove empty params
            Object.keys(params).forEach(key => !params[key] && delete params[key]);

            const result = await API.get('/cases', params);

            if (result.success) {
                // Backend now returns { cases, pagination } in data
                this.renderCases(result.data.cases);
            }
        } catch (error) {
            console.error('Failed to load cases:', error);
        }
    }

    static async loadClients() {
        try {
            const result = await API.get('/clients');
            if (result.success) {
                const select = document.getElementById('clientSelect');
                // Backend now returns { clients, pagination } in data
                const clients = result.data.clients || result.data; // fallback if it's still an array
                select.innerHTML = '<option value="">اختر العميل</option>' +
                    clients.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load clients:', error);
        }
    }

    static renderCases(cases) {
        const container = document.getElementById('casesContainer');

        if (!cases || cases.length === 0) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align:center; padding:4rem; background: var(--glass-bg);">
                    <i class="fas fa-folder-open" style="font-size:4rem; margin-bottom:1.5rem; color:var(--brand-primary); opacity:0.3;"></i>
                    <h3 style="font-weight:800; font-size:1.5rem;">لا توجد قضايا حتى الآن</h3>
                    <p style="color:var(--text-muted);">ابدأ بإضافة أول قضية لمكتبك اليوم.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cases.map(c => `
            <div class="card" style="border-top: 5px solid ${this.getPriorityColor(c.priority)}; display: flex; flex-direction: column; gap: 1rem; position: relative;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-bottom:0.25rem;">رقم القضية: ${c.case_number}</div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-main); line-height:1.4;">${c.title}</h3>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                        <span class="badge" style="background:${this.getStatusColor(c.status)}22; color:${this.getStatusColor(c.status)}; padding:4px 12px; border-radius:8px; font-weight:700; font-size:0.8rem; border: 1px solid ${this.getStatusColor(c.status)}44;">
                            ${c.status}
                        </span>
                        <button onclick="event.stopPropagation(); CasesManager.deleteCase(${c.id})" class="btn-icon" style="color:var(--danger); background:transparent; border:none; cursor:pointer; font-size:1.1rem; opacity:0.7;" title="حذف">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.6rem; color:var(--text-main); font-weight:600; font-size:0.95rem;">
                         <i class="fas fa-user-circle" style="color:var(--brand-primary);"></i> ${c.client_name || 'عميل غير معروف'}
                    </div>
                </div>

                <div style="margin-top:auto; padding-top:1.25rem; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; flex-direction:column; gap:0.25rem;">
                        <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fas fa-calendar-alt"></i> ${Utils.formatDate(c.start_date)}</span>
                        <span style="font-size:0.85rem; font-weight:600; color:var(--brand-primary);">${c.case_type}</span>
                    </div>
                    <div style="display:flex; gap:0.6rem;">
                        <button onclick="event.stopPropagation(); window.open('/api/exports/case/${c.id}/pdf', '_blank')" 
                                class="btn btn-sm btn-outline" title="تصدير PDF" 
                                style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--danger); border-color:${this.getStatusColor('ملغي')}44;">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button onclick="event.stopPropagation(); CasesManager.viewCaseDetails(${c.id})" 
                                class="btn btn-sm btn-primary" 
                                style="border-radius:10px; padding: 0 1rem; font-size:0.8rem;">
                            التفاصيل
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static openNewCaseModal() {
        const modal = document.getElementById('caseModal');
        const form = document.getElementById('caseForm');

        form.reset();
        form.dataset.id = '';
        document.getElementById('modalTitle').textContent = 'إضافة قضية جديدة';

        // No longer suggesting a long timestamp-based number
        document.getElementById('caseNumber').value = '';

        modal.style.display = 'flex';
    }

    static closeCaseModal() {
        document.getElementById('caseModal').style.display = 'none';
        document.getElementById('caseForm').reset();
        document.getElementById('caseForm').dataset.id = '';
    }

    static async saveCase() {
        const id = document.getElementById('caseForm').dataset.id;
        const data = {
            case_number: document.getElementById('caseNumber').value,
            title: document.getElementById('caseTitle').value,
            description: document.getElementById('caseDescription').value,
            case_type: document.getElementById('caseType').value,
            status: document.getElementById('caseStatus').value,
            client_id: document.getElementById('clientSelect').value,
            priority: document.getElementById('casePriority').value,
            court_name: document.getElementById('courtName').value,
            start_date: document.getElementById('startDate').value
        };

        if (!data.title || !data.client_id || !data.case_number) {
            Utils.showMessage('يرجى ملء الحقول الإجبارية (رقم القضية، العنوان، والعميل)', 'warning');
            return;
        }

        try {
            const result = id
                ? await API.put(`/cases/${id}`, data)
                : await API.post('/cases', data);

            if (result && result.success) {
                Utils.showMessage(id ? 'تم تحديث القضية بنجاح' : 'تم إضافة القضية بنجاح', 'success');
                this.closeCaseModal();
                this.loadCases();
            }
        } catch (error) {
            console.error('Save error:', error);
            // Error message already shown by API.request catch block, but we can add more context if needed
        }
    }

    static async viewCaseDetails(id) {
        try {
            const result = await API.get(`/cases/${id}`);
            if (result.success) {
                const c = result.data;
                const modal = document.getElementById('caseModal');
                const form = document.getElementById('caseForm');

                document.getElementById('modalTitle').textContent = 'تعديل القضية';
                form.dataset.id = id;

                document.getElementById('caseNumber').value = c.case_number;
                document.getElementById('caseTitle').value = c.title;
                document.getElementById('caseDescription').value = c.description || '';
                document.getElementById('caseType').value = c.case_type || '';
                document.getElementById('caseStatus').value = c.status;
                document.getElementById('clientSelect').value = c.client_id;
                document.getElementById('courtName').value = c.court_name || '';
                document.getElementById('startDate').value = c.start_date ? c.start_date.split('T')[0] : '';
                document.getElementById('casePriority').value = c.priority;

                modal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error loading case details:', error);
            Utils.showMessage('فشل تحميل تفاصيل القضية', 'error');
        }
    }

    static async deleteCase(id) {
        if (!confirm('هل أنت متأكد من حذف هذه القضية نهائياً؟')) return;

        try {
            const result = await API.delete(`/cases/${id}`);
            if (result && result.success) {
                Utils.showMessage('تم حذف القضية بنجاح', 'success');
                this.loadCases();
            }
        } catch (error) {
            console.error('Delete error:', error);
            // Specific backend error (like linked sessions) will be shown by API.request
        }
    }

    static getStatusColor(status) {
        const map = {
            'جديد': '#3b82f6',
            'قيد التنفيذ': '#eab308',
            'منتهي': '#10b981',
            'ملغي': '#ef4444'
        };
        return map[status] || '#94a3b8';
    }

    static getPriorityColor(priority) {
        const map = {
            'عالي': '#ef4444',
            'متوسط': '#f59e0b',
            'منخفض': '#10b981'
        };
        return map[priority] || '#cbd5e1';
    }
}

// Global Export
window.CasesManager = CasesManager;

// Init
document.addEventListener('DOMContentLoaded', () => CasesManager.init());