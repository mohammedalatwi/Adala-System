/**
 * portal.js - Client Portal Manager (Premium Redesign)
 */
class PortalManager {
    static async init() {
        console.log('🚀 Initializing Premium Client Portal...');

        // Check Auth Status
        const auth = await API.get('/auth/status');
        if (!auth.authenticated) {
            window.location.href = '/login';
            return;
        }

        // Apply Client Branding Info
        if (document.getElementById('clientName')) {
            document.getElementById('clientName').textContent = auth.user.full_name;
        }

        // Logout Handler
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const confirmLogout = confirm('هل أنت متأكد من تسجيل الخروج؟');
                if (confirmLogout) {
                    await API.post('/auth/logout');
                    window.location.href = '/login';
                }
            });
        }

        this.loadData();
    }

    static async loadData() {
        try {
            // Parallel loading for better performance
            const [casesResult, sessionsResult, financeResult, docsResult] = await Promise.all([
                API.get('/cases?limit=5'),
                API.get('/sessions?upcoming=true&limit=5'),
                API.get('/finance/invoices?status=unpaid'),
                API.get('/documents?limit=8')
            ]);

            this.renderCases(casesResult.data || []);
            this.renderSessions(sessionsResult.data || []);
            this.renderFinance(financeResult.data || []);
            this.renderDocuments(docsResult.data || []);

            // Build a synthetic timeline based on cases and recent sessions
            this.renderTimeline(casesResult.data || [], sessionsResult.data || []);

        } catch (error) {
            console.error('Portal load error:', error);
            Utils.showMessage('حدث خطأ أثناء تحميل بيانات البوابة', 'error');
        }
    }

    static renderCases(data) {
        const container = document.getElementById('casesList');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">لا توجد قضايا نشطة حالياً</div>';
            return;
        }

        container.innerHTML = data.map(c => `
            <div style="padding:1rem; border: 1px solid var(--border-color); border-radius:12px; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:700; color:var(--text-main);">${c.title}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${c.case_number} | ${c.court_name || 'المحكمة العامة'}</div>
                </div>
                <span class="badge" style="background:var(--portal-primary); color:white; font-size:0.7rem; padding:4px 10px; border-radius:50px;">${c.status}</span>
            </div>
        `).join('');
    }

    static renderSessions(data) {
        const container = document.getElementById('sessionsList');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">ليس لديك مواعيد قادمة</div>';
            return;
        }

        container.innerHTML = data.map(s => {
            const date = new Date(s.session_date);
            return `
                <div style="padding:1rem; border-right:3px solid #f59e0b; background:var(--bg-surface-hover); border-radius:8px; margin-bottom:0.75rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-size:0.8rem; color:#b45309; font-weight:700;">${date.toLocaleDateString('ar-SA')}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style="font-weight:700;">${s.session_type} - ${s.case_title || 'قضية قائمة'}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;"><i class="fas fa-map-marker-alt"></i> ${s.location || 'موعد افتراضي'}</div>
                </div>
            `;
        }).join('');
    }

    static renderFinance(data) {
        let total = 0;
        const amountEl = document.getElementById('totalDue');

        if (!data || data.length === 0) {
            if (amountEl) amountEl.innerText = '0.00 ر.س';
            return;
        }

        data.forEach(inv => {
            total += (inv.amount - inv.paid_amount);
        });

        if (amountEl) {
            amountEl.innerText = total.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ر.س';
        }
    }

    static renderDocuments(data) {
        const container = document.getElementById('documentsList');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-muted);">لا توجد مستندات متاحة</div>';
            return;
        }

        container.innerHTML = data.map(d => `
            <div class="doc-premium-item">
                <div class="doc-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div style="flex:1; overflow:hidden;">
                    <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.title}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">مستند رسمي - ${new Date(d.created_at).toLocaleDateString('ar-SA')}</div>
                </div>
                <a href="/api/documents/${d.id}/download" class="btn btn-sm btn-icon" title="تحميل">
                    <i class="fas fa-download" style="color:var(--portal-primary);"></i>
                </a>
            </div>
        `).join('');
    }

    static renderTimeline(cases, sessions) {
        const container = document.getElementById('timelineList');
        if (!container) return;

        let events = [];

        // Add cases as "Initiated" events
        cases.forEach(c => {
            events.push({
                date: new Date(c.created_at),
                title: `تم فتح ملف قضية: ${c.title}`,
                desc: `رقم القضية: ${c.case_number}`,
                type: 'case'
            });
        });

        // Add sessions as events
        sessions.forEach(s => {
            events.push({
                date: new Date(s.session_date),
                title: `جلسة ${s.session_type}: ${s.case_title || ''}`,
                desc: `المكان: ${s.location}`,
                type: 'session'
            });
        });

        // Sort by date descending
        events.sort((a, b) => b.date - a.date);

        if (events.length === 0) return;

        container.innerHTML = events.slice(0, 6).map(e => `
            <div class="timeline-event">
                <div class="timeline-dot"></div>
                <div class="event-content">
                    <div class="event-date">
                        <i class="fas ${e.type === 'case' ? 'fa-folder-plus' : 'fa-calendar-check'}"></i>
                        ${e.date.toLocaleDateString('ar-SA')} 
                    </div>
                    <div class="event-title">${e.title}</div>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">${e.desc}</p>
                </div>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => PortalManager.init());
