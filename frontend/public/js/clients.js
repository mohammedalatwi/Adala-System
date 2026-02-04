/**
 * clients.js - V3.0 Clients Manager
 */
class ClientsManager {
    static async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.loadClients();
        this.loadStats();
        console.log('✅ Clients Manager Ready');
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
            Utils.debounce(() => this.loadClients(), 500)
        );

        // Outside modal click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('clientModal')) {
                this.closeClientModal();
            }
        });
    }

    static async loadStats() {
        try {
            // Using system stats endpoint for now, or specific client stats if available
            const result = await API.get('/system/stats');
            if (result.success) {
                const s = result.data;
                document.getElementById('totalClients').textContent = s.total_clients || 0;
                document.getElementById('activeClients').textContent = s.total_clients || 0; // Assuming all active for now
                document.getElementById('totalCases').textContent = s.total_cases || 0;
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    static async loadClients() {
        const container = document.getElementById('clientsContainer');
        container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

        const search = document.getElementById('searchInput').value;
        const params = search ? { search } : {};

        try {
            const result = await API.get('/clients', params);
            if (result.success) {
                // Backend now returns { clients, pagination } in data
                this.renderClients(result.data.clients);
            }
        } catch (error) {
            container.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
        }
    }

    static renderClients(clients) {
        const container = document.getElementById('clientsContainer');

        if (!clients || clients.length === 0) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align:center; padding:4rem; background: var(--glass-bg);">
                    <i class="fas fa-users-slash" style="font-size:4rem; margin-bottom:1.5rem; color:var(--brand-primary); opacity:0.3;"></i>
                    <h3 style="font-weight:800; font-size:1.5rem;">لا يوجد عملاء مضافين</h3>
                    <p style="color:var(--text-muted);">ابدأ بإضافة أول عميل لمكتبك اليوم ليظهر هنا.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = clients.map(client => `
            <div class="card" style="display:flex; flex-direction:column; gap:1.25rem; position:relative;">
                <div style="display:flex; align-items:center; gap:1.25rem;">
                    <div class="user-avatar" style="width:55px; height:55px; font-size:1.3rem; border: 3px solid var(--bg-surface-hover); box-shadow: var(--shadow-sm);">
                        ${client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text-main);">${client.full_name}</h3>
                        <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
                             <span class="badge" style="background:${client.is_active ? 'var(--success)' : 'var(--danger)'}22; color:${client.is_active ? 'var(--success)' : 'var(--danger)'}; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">
                                ${client.is_active ? 'نشط' : 'غير نشط'}
                             </span>
                             <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">#${client.id}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.6rem; background:rgba(0,0,0,0.02); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                    <div style="font-size:0.9rem; color:var(--text-main); display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-phone-alt" style="color:var(--brand-primary); font-size:0.85rem;"></i> ${client.phone || '—'}
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-main); display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-envelope" style="color:var(--brand-primary); font-size:0.85rem;"></i> ${client.email || '—'}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <div style="background:var(--brand-primary); color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800;">
                            ${client.cases_count || 0}
                        </div>
                        <span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">قضية مرتبطة</span>
                    </div>
                    <div style="display:flex; gap:0.6rem;">
                        <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--brand-primary);" onclick="ClientsManager.editClient(${client.id})" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--danger);" onclick="ClientsManager.deleteClient(${client.id})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static openNewClientModal() {
        document.getElementById('modalTitle').textContent = 'إضافة عميل جديد';
        document.getElementById('clientId').value = '';
        document.getElementById('clientForm').reset();
        document.getElementById('clientStatus').value = '1';
        document.getElementById('clientModal').style.display = 'flex';
    }

    static closeClientModal() {
        document.getElementById('clientModal').style.display = 'none';
        document.getElementById('clientForm').reset();
    }

    static async saveClient() {
        const id = document.getElementById('clientId').value;
        const data = {
            full_name: document.getElementById('clientName').value,
            phone: document.getElementById('clientPhone').value,
            email: document.getElementById('clientEmail').value,
            national_id: document.getElementById('clientNationalId').value,
            address: document.getElementById('clientAddress').value,
            is_active: document.getElementById('clientStatus').value,
            notes: document.getElementById('clientNotes').value
        };

        if (!data.full_name || !data.phone) {
            Utils.showMessage('الاسم ورقم الهاتف حقول مطلوبة', 'error');
            return;
        }

        try {
            let result;
            if (id) {
                result = await API.put(`/clients/${id}`, data);
            } else {
                result = await API.post('/clients', data);
            }

            if (result.success) {
                Utils.showMessage('تم حفظ بيانات العميل بنجاح', 'success');
                this.closeClientModal();
                this.loadClients();
                this.loadStats();
            }
        } catch (error) {
            // Handled
        }
    }

    static async editClient(id) {
        try {
            const result = await API.get(`/clients/${id}`);
            if (result.success) {
                const c = result.data;
                document.getElementById('modalTitle').textContent = 'تعديل بيانات العميل';
                document.getElementById('clientId').value = c.id;
                document.getElementById('clientName').value = c.full_name;
                document.getElementById('clientPhone').value = c.phone || '';
                document.getElementById('clientEmail').value = c.email || '';
                document.getElementById('clientNationalId').value = c.national_id || '';
                document.getElementById('clientAddress').value = c.address || '';
                document.getElementById('clientStatus').value = c.is_active ? '1' : '0';

                document.getElementById('clientModal').style.display = 'flex';
            }
        } catch (error) {
            console.error(error);
        }
    }

    static async deleteClient(id) {
        if (confirm('هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.')) {
            try {
                const result = await API.delete(`/clients/${id}`);
                if (result.success) {
                    Utils.showMessage('تم حذف العميل بنجاح', 'success');
                    this.loadClients();
                    this.loadStats();
                }
            } catch (error) {
                // Handled
            }
        }
    }
}

window.ClientsManager = ClientsManager;
document.addEventListener('DOMContentLoaded', () => ClientsManager.init());
