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

        // Check for URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const caseId = urlParams.get('case_id');
        const action = urlParams.get('action');

        if (caseId) {
            const filter = document.getElementById('caseFilter');
            if (filter) filter.value = caseId;

            if (action === 'new') {
                this.openNewSessionModal();
                const sessionCase = document.getElementById('sessionCase');
                if (sessionCase) sessionCase.value = caseId;
            }
        }

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
        // زر تسجيل الخروج يُهيّأ مركزياً في Utils.initGlobal()

        document.getElementById('listViewBtn').addEventListener('click', () => this.toggleView('list'));
        document.getElementById('calendarViewBtn').addEventListener('click', () => this.toggleView('calendar'));

        // Filters
        document.getElementById('searchInput').addEventListener('input', Utils.debounce(() => this.loadSessions(), 500));
        document.getElementById('statusFilter').addEventListener('change', () => this.loadSessions());
        document.getElementById('caseFilter').addEventListener('change', () => this.loadSessions());
        document.getElementById('timelineFilter').addEventListener('change', () => this.loadSessions());
        document.getElementById('sessionStatus').addEventListener('change', () => this.handleStatusChange());

        // Modal outside click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('sessionModal')) {
                this.closeSessionModal();
            }
        });

        // أزرار ثابتة بلا معطيات (بدون onclick لتوافق CSP)
        document.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.action;
                if (typeof this[action] === 'function') this[action]();
            });
        });

        // بطاقات الجلسات المُولّدة ديناميكياً (تفويض عبر data-id بدل onclick)
        document.getElementById('sessionsContainer').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-card-action]');
            if (!btn) return;
            e.stopPropagation();
            const { cardAction, id } = btn.dataset;
            switch (cardAction) {
                case 'open-case': window.location.href = `/cases?case_id=${id}`; break;
                case 'edit': this.editSession(id); break;
                case 'delete': this.deleteSession(id); break;
            }
        });
    }

    static async loadCasesForFilter() {
        try {
            const result = await API.get('/cases?limit=100');
            if (result && result.success) {
                const cases = result.data.cases || result.data;
                const options = '<option value="">اختر القضية</option>' +
                    cases.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.case_number)} - ${Utils.escapeHTML(c.title)}</option>`).join('');

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

        // 1. Group sessions by date category
        const groups = {
            today: { label: 'اليوم', sessions: [] },
            tomorrow: { label: 'غداً', sessions: [] },
            upcoming: { label: 'قادمة', sessions: [] },
            past: { label: 'سابقة', sessions: [] }
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        sessions.forEach(s => {
            const sDate = new Date(s.session_date);
            const sDateOnly = new Date(sDate);
            sDateOnly.setHours(0, 0, 0, 0);

            if (sDateOnly.getTime() === today.getTime()) {
                groups.today.sessions.push({ ...s, dateObj: sDate });
            } else if (sDateOnly.getTime() === tomorrow.getTime()) {
                groups.tomorrow.sessions.push({ ...s, dateObj: sDate });
            } else if (sDateOnly > today) {
                groups.upcoming.sessions.push({ ...s, dateObj: sDate });
            } else {
                groups.past.sessions.push({ ...s, dateObj: sDate });
            }
        });

        // Sub-group "upcoming" and "past" by specific dates
        const buildTimelineHtml = (groupKey) => {
            const group = groups[groupKey];
            if (group.sessions.length === 0) return '';

            // Sort chronically
            group.sessions.sort((a, b) => groupKey === 'past' ? b.dateObj - a.dateObj : a.dateObj - b.dateObj);

            let html = '';

            // For upcoming/past, we group by exact date string. For today/tomorrow, just one header
            if (groupKey === 'today' || groupKey === 'tomorrow') {
                html += `<div class="timeline-date-header">${group.label}</div>`;
                html += `<div style="display:grid; gap:1rem;">${group.sessions.map(s => this.buildCompactCard(s)).join('')}</div>`;
            } else {
                const dateMap = {};
                group.sessions.forEach(s => {
                    const dateStr = s.dateObj.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    if (!dateMap[dateStr]) dateMap[dateStr] = [];
                    dateMap[dateStr].push(s);
                });

                Object.keys(dateMap).forEach(dateStr => {
                    html += `<div class="timeline-date-header">${dateStr}</div>`;
                    html += `<div style="display:grid; gap:1rem;">${dateMap[dateStr].map(s => this.buildCompactCard(s)).join('')}</div>`;
                });
            }
            return html;
        };

        container.innerHTML =
            buildTimelineHtml('today') +
            buildTimelineHtml('tomorrow') +
            buildTimelineHtml('upcoming') +
            buildTimelineHtml('past');
    }

    static buildCompactCard(s) {
        const timeStr = s.dateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }).split(' ');
        const timeVal = timeStr[0];
        const periodVal = timeStr[1] || '';

        const statusColor = this.getStatusColor(s.status);

        return `
            <div class="session-card-compact" style="border-right: 4px solid ${statusColor};">
                <div class="session-time-col">
                    <div class="session-time" style="color: ${statusColor}">${timeVal}</div>
                    <div class="session-period">${periodVal}</div>
                </div>
                <div class="session-details-col">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h3 class="session-title" data-card-action="open-case" data-id="${s.case_id}">${Utils.escapeHTML(s.case_title)}</h3>
                        <span class="badge" style="background:${statusColor}22; color:${statusColor}; padding:2px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">
                            ${Utils.escapeHTML(s.status)}
                        </span>
                    </div>
                    <div class="session-meta">
                        <span><i class="fas fa-gavel"></i> ${Utils.escapeHTML(s.session_type)}</span>
                        <span><i class="fas fa-map-marker-alt"></i> ${s.city ? Utils.escapeHTML(s.city) : ''} ${s.location ? '- ' + Utils.escapeHTML(s.location) : ''}</span>
                        <span><i class="fas fa-user-tie"></i> ${s.judge_name ? Utils.escapeHTML(s.judge_name) : 'القاضي غير محدد'}</span>
                        <span style="opacity:0.6;"><i class="fas fa-hashtag"></i> #${s.id}</span>
                    </div>
                </div>
                <div class="session-actions-col">
                    <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--brand-primary);" title="تعديل" data-card-action="edit" data-id="${s.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" style="width:36px; height:36px; padding:0; border-radius:10px; color:var(--danger);" data-card-action="delete" data-id="${s.id}" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
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
