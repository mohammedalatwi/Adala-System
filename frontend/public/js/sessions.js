/**
 * sessions.js - V2.0 Sessions Manager
 */
class SessionsManager {
    static calendar = null;
    static currentView = 'list';

    static async init() {
        await this.checkAuth();
        this.setupEventListeners();

        // Load filter data first
        await this.loadCasesForFilter();

        // Load main data
        this.loadSessions();

        console.log('✅ Sessions Manager Ready');
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

        document.getElementById('listViewBtn').addEventListener('click', () => this.toggleView('list'));
        document.getElementById('calendarViewBtn').addEventListener('click', () => this.toggleView('calendar'));

        // Filters
        document.getElementById('searchInput').addEventListener('input', Utils.debounce(() => this.loadSessions(), 500));
        document.getElementById('statusFilter').addEventListener('change', () => this.loadSessions());
        document.getElementById('caseFilter').addEventListener('change', () => this.loadSessions());
        document.getElementById('timelineFilter').addEventListener('change', () => this.loadSessions());

        // Modal outside click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('sessionModal')) {
                this.closeSessionModal();
            }
        });
    }

    static async loadCasesForFilter() {
        try {
            const result = await API.get('/cases?limit=100');
            if (result.success) {
                const options = '<option value="">اختر القضية</option>' +
                    result.data.map(c => `<option value="${c.id}">${c.case_number} - ${c.title}</option>`).join('');

                document.getElementById('caseFilter').innerHTML = '<option value="">جميع القضايا</option>' + options;
                document.getElementById('sessionCase').innerHTML = options;
            }
        } catch (error) {
            console.error('Failed to load cases:', error);
        }
    }

    static async loadSessions() {
        if (this.currentView === 'list') {
            await this.loadListView();
        } else {
            if (this.calendar) this.calendar.refetchEvents();
        }
    }

    static async loadListView() {
        const container = document.getElementById('sessionsContainer');
        container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

        const params = {
            search: document.getElementById('searchInput').value,
            status: document.getElementById('statusFilter').value,
            case_id: document.getElementById('caseFilter').value,
            upcoming: document.getElementById('timelineFilter').value === 'upcoming' ? 'true' : ''
        };
        // Clean params
        Object.keys(params).forEach(key => !params[key] && delete params[key]);

        try {
            const result = await API.get('/sessions', { ...params, limit: 50 });
            if (result.success) {
                this.renderList(result.data);
            }
        } catch (error) {
            container.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
        }
    }

    static renderList(sessions) {
        const container = document.getElementById('sessionsContainer');

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius); border:1px solid var(--border-color);">
                    <i class="fas fa-calendar-times" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <h3>لا توجد جلسات</h3>
                    <p>لا توجد جلسات تطابق بحثك</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sessions.map(s => `
            <div class="card" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:1rem;" onclick="console.log('Open session ${s.id}')">
                <div style="display:flex; align-items:center; gap:1.5rem;">
                    <div style="text-align:center; min-width:60px;">
                        <div style="font-weight:bold; font-size:1.2rem; color:var(--brand-primary);">${new Date(s.session_date).getDate()}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(s.session_date).toLocaleDateString('ar-SA', { month: 'short' })}</div>
                    </div>
                    <div>
                        <div style="font-weight:600; font-size:1.1rem; margin-bottom:0.25rem;">${s.case_title}</div>
                        <div style="color:var(--text-muted); font-size:0.9rem;">
                            <i class="fas fa-gavel"></i> ${s.session_type} &bull; 
                            <i class="fas fa-map-marker-alt"></i> ${s.location} &bull; 
                            <i class="fas fa-clock"></i> ${new Date(s.session_date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
                <div>
                    <span class="badge" style="background:${this.getStatusColor(s.status)}; color:white; padding:4px 10px; border-radius:12px; font-size:0.85rem;">
                        ${s.status}
                    </span>
                    <button class="btn btn-sm btn-outline text-danger" style="border:none; margin-right:1rem;" onclick="event.stopPropagation(); SessionsManager.deleteSession(${s.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    static toggleView(view) {
        this.currentView = view;
        const listBtn = document.getElementById('listViewBtn');
        const calBtn = document.getElementById('calendarViewBtn');
        const listContainer = document.getElementById('sessionsContainer');
        const filters = document.getElementById('filtersSection');
        const calendarWrapper = document.getElementById('calendarWrapper');

        if (view === 'list') {
            listBtn.className = 'btn btn-sm active';
            listBtn.style.background = 'var(--brand-primary)';
            listBtn.style.color = 'white';

            calBtn.className = 'btn btn-sm';
            calBtn.style.background = 'transparent';
            calBtn.style.color = 'var(--text-muted)';

            listContainer.style.display = 'grid';
            filters.style.display = 'flex';
            calendarWrapper.style.display = 'none';

            this.loadListView();
        } else {
            calBtn.className = 'btn btn-sm active';
            calBtn.style.background = 'var(--brand-primary)';
            calBtn.style.color = 'white';

            listBtn.className = 'btn btn-sm';
            listBtn.style.background = 'transparent';
            listBtn.style.color = 'var(--text-muted)';

            listContainer.style.display = 'none';
            filters.style.display = 'none';
            calendarWrapper.style.display = 'block';

            this.initCalendar();
        }
    }

    static initCalendar() {
        if (this.calendar) {
            this.calendar.render();
            this.calendar.refetchEvents();
            return;
        }

        const calendarEl = document.getElementById('calendar');
        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            direction: 'rtl',
            locale: 'ar',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            height: '100%',
            events: async (info, success, failure) => {
                try {
                    const result = await API.get('/sessions?limit=200'); // Load more for calendar
                    if (result.success) {
                        const events = result.data.map(s => ({
                            id: s.id,
                            title: `${s.case_title} (${s.session_type})`,
                            start: s.session_date,
                            backgroundColor: this.getStatusColor(s.status),
                            borderColor: this.getStatusColor(s.status)
                        }));
                        success(events);
                    }
                } catch (e) {
                    failure(e);
                }
            }
        });

        this.calendar.render();
    }

    static openNewSessionModal() {
        document.getElementById('sessionModal').style.display = 'flex';
    }

    static closeSessionModal() {
        document.getElementById('sessionModal').style.display = 'none';
        document.getElementById('sessionForm').reset();
    }

    static async saveSession() {
        const data = {
            case_id: document.getElementById('sessionCase').value,
            session_date: document.getElementById('sessionDate').value,
            session_type: document.getElementById('sessionType').value,
            location: document.getElementById('sessionLocation').value,
            judge_name: document.getElementById('sessionJudge').value,
            session_notes: document.getElementById('sessionNotes').value
        };

        if (!data.case_id || !data.session_date || !data.location) {
            Utils.showMessage('يرجى ملء الحقول الإجبارية', 'error');
            return;
        }

        try {
            const result = await API.post('/sessions', data);
            if (result.success) {
                Utils.showMessage('تم حفظ الجلسة بنجاح', 'success');
                this.closeSessionModal();
                this.loadSessions();
            }
        } catch (error) {
            // Handled
        }
    }


    static async deleteSession(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;

        try {
            const result = await API.delete(`/sessions/${id}`);
            if (result.success) {
                Utils.showMessage('تم حذف الجلسة بنجاح', 'success');
                this.loadSessions();
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    }

    static getStatusColor(status) {
        const map = {
            'مجدول': '#3b82f6',
            'منعقد': '#eab308',
            'مكتمل': '#10b981',
            'ملغي': '#ef4444'
        };
        return map[status] || '#94a3b8';
    }
}

window.SessionsManager = SessionsManager;
document.addEventListener('DOMContentLoaded', () => SessionsManager.init());
