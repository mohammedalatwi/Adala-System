/**
 * client-profile.js - V3.0 Client Profile Manager
 */
class ClientProfile {
    static clientId = null;
    static data = null;

    static async init() {
        await this.checkAuth();

        const urlParams = new URLSearchParams(window.location.search);
        this.clientId = urlParams.get('id');

        if (!this.clientId) {
            window.location.href = '/clients';
            return;
        }

        // زر تسجيل الخروج يُهيّأ مركزياً في Utils.initGlobal()

        await this.loadProfileData();
        console.log('✅ Client Profile Manager Ready');
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

    static switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`.tab-btn[onclick="ClientProfile.switchTab('${tabId}')"]`).classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');
    }

    static async loadProfileData() {
        try {
            const result = await API.get(`/clients/${this.clientId}`);
            if (result.success) {
                this.data = result.data;
                this.renderHeader();
                this.renderCases();
                this.renderSessions();
                this.renderFinancials();
                this.renderDocuments();
                this.updateBadges();
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            Utils.showMessage('فشل في تحميل بيانات العميل', 'error');
            setTimeout(() => window.location.href = '/clients', 2000);
        }
    }

    static updateBadges() {
        document.getElementById('badge-cases').textContent = this.data.cases?.length || 0;
        document.getElementById('badge-sessions').textContent = this.data.sessions?.length || 0;
        document.getElementById('badge-financial').textContent = this.data.transactions?.length || 0;
        document.getElementById('badge-documents').textContent = this.data.documents?.length || 0;
    }

    static renderHeader() {
        const c = this.data.client;
        const container = document.getElementById('profileHeader');

        container.innerHTML = `
            <div class="profile-avatar-large">
                ${c.full_name.charAt(0).toUpperCase()}
            </div>
            <div class="profile-info">
                <h1 class="profile-name">${c.full_name}</h1>
                <div class="profile-meta">
                    ${c.national_id ? `<div class="profile-meta-item"><i class="fas fa-id-card"></i> ${c.national_id}</div>` : ''}
                    ${c.phone ? `<div class="profile-meta-item"><i class="fas fa-phone"></i> ${c.phone}</div>` : ''}
                    ${c.email ? `<div class="profile-meta-item"><i class="fas fa-envelope"></i> ${c.email}</div>` : ''}
                    ${c.address ? `<div class="profile-meta-item"><i class="fas fa-map-marker-alt"></i> ${c.address}</div>` : ''}
                </div>
                <div style="margin-top: 1rem;">
                    <span class="badge" style="background:${c.is_active ? 'var(--success)' : 'var(--danger)'}22; color:${c.is_active ? 'var(--success)' : 'var(--danger)'}; padding:5px 12px; font-size:0.9rem;">
                        ${c.is_active ? 'عميل نشط' : 'عميل غير نشط'}
                    </span>
                    <span style="color:var(--text-muted); font-size:0.85rem; margin-right:1rem;"><i class="fas fa-hashtag"></i> #${c.id}</span>
                </div>
            </div>
        `;
    }

    static renderCases() {
        const container = document.getElementById('tab-cases');
        const cases = this.data.cases || [];

        if (cases.length === 0) {
            container.innerHTML = this.getEmptyState('gavel', 'لا توجد قضايا مرتبطة بهذا العميل');
            return;
        }

        container.innerHTML = cases.map(c => `
            <div class="card" style="display:flex; flex-direction:column; gap:1rem; cursor:pointer;" onclick="window.location.href='/cases?case_id=${c.id}'">
                <div style="display:flex; justify-content:space-between;">
                    <div class="badge" style="background:var(--brand-primary)22; color:var(--brand-primary);">${c.case_number}</div>
                    <div class="badge" style="background:#fef3c7; color:#d97706;">${c.status}</div>
                </div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-main);">${c.title}</h3>
                <div style="color:var(--text-muted); font-size:0.85rem;">
                    <i class="fas fa-university"></i> ${c.court_name || 'جهة غير محددة'}
                </div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-color);">
                    تاريخ الفتح: ${new Date(c.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    }

    static renderSessions() {
        const container = document.getElementById('tab-sessions');
        const sessions = this.data.sessions || [];

        if (sessions.length === 0) {
            container.innerHTML = this.getEmptyState('calendar-times', 'لا توجد جلسات مسجلة ضمن قضايا العميل');
            return;
        }

        container.innerHTML = sessions.map(s => {
            const sDate = new Date(s.session_date);
            return `
            <div class="card" style="display:flex; flex-direction:column; gap:0.5rem; border-right: 4px solid var(--brand-primary);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <div style="font-size:1.1rem; font-weight:800; color:var(--text-main);">${s.case_title}</div>
                    <span class="badge" style="background:#e0e7ff; color:var(--brand-primary);">${s.status}</span>
                </div>
                <div style="color:var(--text-main); display:flex; gap:0.5rem; align-items:center;">
                    <i class="fas fa-clock" style="color:var(--text-muted);"></i>
                    <strong>${sDate.toLocaleDateString('ar-SA')} - ${sDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                <div style="color:var(--text-muted); font-size:0.9rem;">
                    <i class="fas fa-map-marker-alt"></i> ${s.location} (${s.session_type})
                </div>
            </div>
            `;
        }).join('');
    }

    static renderFinancials() {
        const tbody = document.getElementById('financialTableBody');
        const transactions = this.data.transactions || [];

        if (transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">لا توجد حركات مالية مسجلة</td></tr>`;
            return;
        }

        tbody.innerHTML = transactions.map(t => {
            const isIncome = t.type === 'income';
            return `
            <tr>
                <td>${new Date(t.transaction_date).toLocaleDateString()}</td>
                <td style="font-family:monospace; color:var(--text-muted);">${t.receipt_number || '—'}</td>
                <td>
                    <span class="badge" style="background:${isIncome ? 'var(--success)' : 'var(--danger)'}22; color:${isIncome ? 'var(--success)' : 'var(--danger)'};">
                        ${isIncome ? 'سند قبض' : 'سند صرف'}
                    </span>
                </td>
                <td style="font-weight:bold; color:${isIncome ? 'var(--success)' : 'var(--danger)'};">
                    ${isIncome ? '+' : '-'}${parseFloat(t.amount).toLocaleString()} ر.س
                </td>
                <td>${t.case_title}</td>
                <td>${this.translatePaymentMethod(t.payment_method)}</td>
            </tr>
            `;
        }).join('');
    }

    static renderDocuments() {
        const container = document.getElementById('tab-documents');
        const documents = this.data.documents || [];

        if (documents.length === 0) {
            container.innerHTML = this.getEmptyState('folder-open', 'لا توجد مستندات مرفوعة');
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="card" style="display:flex; align-items:center; gap:1rem; cursor:pointer;" onclick="window.open('/api/documents/${doc.id}/download', '_blank')">
                <div style="width:40px; height:40px; border-radius:10px; background:var(--bg-surface-hover); display:flex; align-items:center; justify-content:center; color:var(--brand-primary); font-size:1.2rem;">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1rem; font-weight:700; color:var(--text-main);">${doc.title}</h4>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                        ${doc.case_title}
                    </div>
                </div>
                <div style="color:var(--text-muted); font-size:0.85rem;">
                    ${new Date(doc.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    }

    static translatePaymentMethod(method) {
        const map = {
            'cash': 'نقدي',
            'bank_transfer': 'تحويل بنكي',
            'cheque': 'شيك',
            'card': 'بطاقة إلكترونية'
        };
        return map[method] || method;
    }

    static getEmptyState(icon, text) {
        return `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-${icon} empty-icon"></i>
                <div class="empty-text">${text}</div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => ClientProfile.init());
