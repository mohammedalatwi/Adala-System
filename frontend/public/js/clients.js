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
                this.renderClients(result.data);
            }
        } catch (error) {
            container.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
        }
    }

    static renderClients(clients) {
        const container = document.getElementById('clientsContainer');

        if (!clients || clients.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius); border:1px solid var(--border-color);">
                    <i class="fas fa-users" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <h3>لا يوجد عملاء</h3>
                    <p>أضف علاء جدد لإدارتهم هنا</p>
                </div>
            `;
            return;
        }

        container.innerHTML = clients.map(client => `
            <div class="card" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center; padding:1.5rem;">
                <div style="display:flex; align-items:center; gap:1.5rem;">
                    <div class="user-avatar" style="width:50px; height:50px; font-size:1.2rem;">
                        ${client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:1.1rem; margin-bottom:0.25rem;">${client.full_name}</div>
                        <div style="color:var(--text-muted); font-size:0.9rem;">
                            <i class="fas fa-phone"></i> ${client.phone || 'غير متوفر'} &bull; 
                            <i class="fas fa-envelope"></i> ${client.email || 'غير متوفر'}
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <div style="text-align:center; margin-left:1rem;">
                        <span style="display:block; font-weight:bold; color:var(--brand-primary);">${client.cases_count || 0}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">قضايا</span>
                    </div>
                    <button class="btn btn-outline" style="padding:0.4rem 0.8rem;" onclick="ClientsManager.editClient(${client.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline" style="padding:0.4rem 0.8rem; color:var(--danger);" onclick="ClientsManager.deleteClient(${client.id})">
                        <i class="fas fa-trash"></i>
                    </button>
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
