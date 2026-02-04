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
            if (result && result.success) {
                const cases = result.data.cases || result.data;
                const options = '<option value="">اختر القضية</option>' +
                    cases.map(c => `<option value="${c.id}">${c.case_number} - ${c.title}</option>`).join('');

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
            if (result && result.success) {
                // Backend now returns { sessions, pagination } in data
                this.renderList(result.data.sessions);
            }
        } catch (error) {
            container.innerHTML = '<div style="text-align:center; color:red;">فشل تحميل البيانات</div>';
        }
    }

    static renderList(sessions) {
        const container = document.getElementById('sessionsContainer');

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align:center; padding:4rem; background: var(--glass-bg);">
                    <i class="fas fa-calendar-times" style="font-size:4rem; margin-bottom:1.5rem; color:var(--brand-primary); opacity:0.3;"></i>
                    <h3 style="font-weight:800; font-size:1.5rem;">لا توجد جلسات مجدولة</h3>
                    <p style="color:var(--text-muted);">ابدأ بجدولة جلساتك القضائية لتظهر هنا بشكل منظم.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sessions.map(s => {
            const sDate = new Date(s.session_date);
            return `
            <div class="card" style="display:flex; flex-direction:column; gap:1.25rem; position:relative;">
                <div style="display:flex; align-items:center; gap:1.25rem;">
                    <div style="background:var(--brand-primary); color:white; min-width:65px; height:65px; border-radius:18px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);">
                        <div style="font-size:1.4rem; font-weight:800; line-height:1;">${sDate.getDate()}</div>
                        <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">${sDate.toLocaleDateString('ar-SA', { month: 'short' })}</div>
                    </div>
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text-main); line-height:1.4;">${s.case_title}</h3>
                        <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
                             <span class="badge" style="background:${this.getStatusColor(s.status)}22; color:${this.getStatusColor(s.status)}; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">
                                ${s.status}
                             </span>
                             <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;"><i class="fas fa-hashtag"></i> #${s.id}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.6rem; background:rgba(0,0,0,0.02); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
                    <div style="font-size:0.9rem; color:var(--text-main); display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-clock" style="color:var(--brand-primary); font-size:0.85rem;"></i> ${sDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-main); display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-map-marker-alt" style="color:var(--brand-primary); font-size:0.85rem;"></i> ${s.city || ''} - ${s.location}
                    </div>
                    <div style="font-size:0.9rem; color:var(--text-main); display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-gavel" style="color:var(--brand-primary); font-size:0.85rem;"></i> ${s.session_type}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-color);">
                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">
                         <i class="fas fa-user-tie"></i> ${s.judge_name || 'غير محدد'}
                    </div>
                    <div style="display:flex; gap:0.6rem;">
                        <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--brand-primary);" title="تعديل" onclick="SessionsManager.editSession(${s.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--danger);" onclick="event.stopPropagation(); SessionsManager.deleteSession(${s.id})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
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
                right: 'dayGridMonth,timeGridWeek,listWeek'
            },
            height: '100%',
            events: async (info, success, failure) => {
                try {
                    // Fetch more events just in case
                    const result = await API.get('/sessions?limit=300');
                    if (result.success) {
                        const sessions = result.data.sessions || result.data;
                        const events = sessions.map(s => ({
                            id: s.id,
                            title: `[${s.case_number}] ${s.case_title}`,
                            start: s.session_date,
                            backgroundColor: this.getStatusColor(s.status),
                            borderColor: this.getStatusColor(s.status),
                            extendedProps: {
                                type: s.session_type,
                                location: s.location,
                                status: s.status
                            }
                        }));
                        success(events);
                    }
                } catch (e) {
                    console.error('Calendar Fetch Error:', e);
                    failure(e);
                }
            },
            eventClick: (info) => this.editSession(info.event.id),
            eventDidMount: (info) => {
                // Quick tooltip or simple description logic could go here
                info.el.title = `${info.event.title}\nالمكان: ${info.event.extendedProps.location}`;
            }
        });

        this.calendar.render();
    }

    static openNewSessionModal() {
        document.getElementById('modalTitle').textContent = 'إضافة جلسة جديدة';
        document.getElementById('sessionForm').dataset.id = '';
        document.getElementById('sessionModal').style.display = 'flex';
    }

    static closeSessionModal() {
        document.getElementById('sessionModal').style.display = 'none';
        document.getElementById('sessionForm').reset();
    }

    static handleStatusChange() {
        const status = document.getElementById('sessionStatus').value;
        const adjSection = document.getElementById('adjournmentSection');
        if (status === 'مؤجل') {
            adjSection.style.display = 'block';
        } else {
            adjSection.style.display = 'none';
        }
    }

    static async saveSession() {
        const id = document.getElementById('sessionForm').dataset.id;
        const caseId = document.getElementById('sessionCase').value;
        const sessionDate = document.getElementById('sessionDate').value;
        const location = document.getElementById('sessionLocation').value;

        if (!caseId || !sessionDate || !location) {
            Utils.showMessage('يرجى اختيار القضية وتحديد التاريخ والمكان', 'warning');
            return;
        }

        const data = {
            case_id: caseId,
            session_date: sessionDate,
            session_type: document.getElementById('sessionType').value,
            city: document.getElementById('sessionCity').value,
            location: location,
            judge_name: document.getElementById('sessionJudge').value,
            attendees: document.getElementById('sessionAttendees').value,
            session_notes: document.getElementById('sessionNotes').value,
            adjournment_reason: document.getElementById('adjournmentReason').value,
            status: document.getElementById('sessionStatus').value
        };

        try {
            const result = id
                ? await API.put(`/sessions/${id}`, data)
                : await API.post('/sessions', data);

            if (result.success) {
                Utils.showMessage(id ? 'تم تحديث الجلسة بنجاح' : 'تم إضافة الجلسة بنجاح', 'success');

                // Adjournment Workflow: If status is 'مؤجل', ask to schedule next one
                const status = data.status;
                const caseId = data.case_id;

                this.closeSessionModal();
                this.loadSessions();

                if (status === 'مؤجل') {
                    setTimeout(() => {
                        if (confirm('الجلسة تأجلت. هل تود جدولة الجلسة القادمة الآن؟')) {
                            this.openNewSessionModal();
                            document.getElementById('sessionCase').value = caseId;
                            document.getElementById('sessionStatus').value = 'مجدول';
                            document.getElementById('sessionType').value = data.session_type;
                            document.getElementById('sessionLocation').value = data.location;
                            document.getElementById('sessionDate').focus();
                        }
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Save error:', error);
            Utils.showMessage('فشل في حفظ الجلسة. تأكد من صحة البيانات.', 'error');
        }
    }

    static async editSession(id) {
        try {
            const result = await API.get(`/sessions/${id}`);
            if (result.success) {
                const s = result.data;
                this.openNewSessionModal();
                document.getElementById('modalTitle').textContent = 'تعديل الجلسة';
                document.getElementById('sessionForm').dataset.id = id;

                document.getElementById('sessionCase').value = s.case_id;
                document.getElementById('sessionDate').value = this.formatDateForInput(s.session_date);
                document.getElementById('sessionType').value = s.session_type;
                document.getElementById('sessionStatus').value = s.status || 'مجدول';
                document.getElementById('sessionCity').value = s.city || '';
                document.getElementById('sessionLocation').value = s.location;
                document.getElementById('sessionJudge').value = s.judge_name || '';
                document.getElementById('sessionAttendees').value = s.attendees || '';
                document.getElementById('sessionNotes').value = s.session_notes || '';
                document.getElementById('adjournmentReason').value = s.adjournment_reason || '';

                this.handleStatusChange();
            }
        } catch (error) {
            console.error('Edit error:', error);
            Utils.showMessage('فشل تحميل بيانات الجلسة', 'error');
        }
    }

    static formatDateForInput(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    static async deleteSession(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
        try {
            const result = await API.delete(`/sessions/${id}`);
            if (result.success) {
                Utils.showMessage('تم الحذف بنجاح', 'success');
                this.loadSessions();
            }
        } catch (error) {
            console.error('Delete error:', error);
            // Specific backend error will be shown by API.request
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
