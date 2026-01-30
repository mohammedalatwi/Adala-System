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
                this.renderCases(result.data);
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
                select.innerHTML = '<option value="">اختر العميل</option>' +
                    result.data.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Failed to load clients:', error);
        }
    }

    static renderCases(cases) {
        const container = document.getElementById('casesContainer');

        if (!cases || cases.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <h3>لا يوجد قضايا</h3>
                    <p>قم بإضافة قضية جديدة للبدء</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cases.map(c => `
            <div class="card" style="border-left: 4px solid ${this.getPriorityColor(c.priority)}; cursor:pointer; transition:transform 0.2s;" 
                 onclick="console.log('View case ${c.id}')">
                <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                    <span style="font-weight:bold; color:var(--brand-primary);">${c.case_number}</span>
                    <span class="badge" style="background:${this.getStatusColor(c.status)}; color:white; padding:2px 8px; border-radius:12px; font-size:0.8rem;">
                        ${c.status}
                    </span>
                </div>
                <h3 style="margin:0 0 0.5rem 0; font-size:1.1rem;">${c.title}</h3>
                <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">
                     ${c.client_name ? `<i class="fas fa-user"></i> ${c.client_name}` : ''}
                </div>
                <div style="border-top:1px solid var(--border-color); padding-top:0.8rem; display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
                    <span><i class="fas fa-calendar"></i> ${Utils.formatDate(c.start_date)}</span>
                    <div style="display:flex; gap:8px;">
                        <span style="color:var(--text-muted);">${c.case_type}</span>
                        <button onclick="event.stopPropagation(); window.open('/api/exports/case/${c.id}/pdf', '_blank')" 
                                class="btn btn-sm btn-icon" title="تصدير PDF" 
                                style="background:#eff6ff; color:var(--brand-primary); padding:2px 6px; border-radius:6px;">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static openNewCaseModal() {
        console.log('Open Modal Triggered');
        const caseNumberInput = document.getElementById('caseNumber');
        const modal = document.getElementById('caseModal');

        if (!caseNumberInput || !modal) {
            console.error('Modal elements missing!', { caseNumberInput, modal });
            return;
        }

        caseNumberInput.value = `CASE-${Date.now()}`; // Temporary ID generation
        modal.style.display = 'flex';
        console.log('Modal display set to flex');
    }

    static closeCaseModal() {
        document.getElementById('caseModal').style.display = 'none';
        document.getElementById('caseForm').reset();
    }

    static async saveCase() {
        const data = {
            case_number: document.getElementById('caseNumber').value,
            title: document.getElementById('caseTitle').value,
            description: document.getElementById('caseDescription').value,
            case_type: document.getElementById('caseType').value,
            status: document.getElementById('caseStatus').value,
            client_id: document.getElementById('clientSelect').value,
            priority: document.getElementById('casePriority').value,
            court_name: document.getElementById('courtName').value,
            start_date: document.getElementById('startDate').value,
            // Mock lawyer ID for now (logged in user usually)
            lawyer_id: 1
        };

        if (!data.title || !data.client_id) {
            Utils.showMessage('يرجى ملء الحقول الإجبارية', 'error');
            return;
        }

        try {
            const result = await API.post('/cases', data);
            if (result.success) {
                Utils.showMessage('تم حفظ القضية بنجاح', 'success');
                this.closeCaseModal();
                this.loadCases();
            }
        } catch (error) {
            // Error handled by API Client
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