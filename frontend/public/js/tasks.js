/**
 * tasks.js - Tasks Management Logic
 */
class TasksManager {
    static async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadCases();
        await this.loadTeam();
        await this.loadTasks();

        // Start auto-refresh every 60 seconds
        this.startAutoRefresh();

        console.log('✅ Tasks Manager Ready');
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

        document.getElementById('searchInput').addEventListener('input', Utils.debounce(() => this.loadTasks(), 500));
        document.getElementById('statusFilter').addEventListener('change', () => this.loadTasks());
        document.getElementById('priorityFilter').addEventListener('change', () => this.loadTasks());

        // Modal outside click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('taskModal')) {
                this.closeTaskModal();
            }
        });

        // أزرار ثابتة بلا معطيات (بدون onclick لتوافق CSP)
        document.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.action;
                if (typeof this[action] === 'function') this[action]();
            });
        });

        // بطاقات المهام المُولّدة ديناميكياً (تفويض عبر data-id بدل onclick)
        document.getElementById('tasksGrid').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-card-action]');
            if (!btn) return;
            const { cardAction, id, status } = btn.dataset;
            switch (cardAction) {
                case 'toggle-status': this.toggleStatus(id, status); break;
                case 'edit': this.editTask(id); break;
                case 'delete': this.deleteTask(id); break;
            }
        });
    }

    static async loadCases() {
        try {
            const res = await API.get('/cases?limit=100');
            if (res.success) {
                const cases = res.data.cases || res.data;
                const options = cases.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.title)}</option>`).join('');
                document.getElementById('taskCase').insertAdjacentHTML('beforeend', options);
            }
        } catch (e) {
            console.error('Load cases error:', e);
        }
    }

    static async loadTeam() {
        try {
            const res = await API.get('/team');
            if (res.success) {
                const members = res.data;
                const options = members.map(m => `<option value="${m.id}">${Utils.escapeHTML(m.full_name)} (${Utils.escapeHTML(m.role)})</option>`).join('');
                document.getElementById('taskAssignedTo').insertAdjacentHTML('beforeend', options);
            }
        } catch (e) {
            console.error('Load team error:', e);
        }
    }

    static async loadTasks() {
        const grid = document.getElementById('tasksGrid');
        // Only show loading if grid is empty (first load)
        if (grid.children.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
        }

        const params = {
            status: document.getElementById('statusFilter').value,
            priority: document.getElementById('priorityFilter').value,
            search: document.getElementById('searchInput').value
        };

        // Clean params
        Object.keys(params).forEach(key => !params[key] && delete params[key]);

        try {
            const result = await API.get('/tasks', params);
            if (result.success) {
                const tasks = result.data.tasks || result.data;
                this.renderTasks(tasks);
                this.updateStats(tasks);
            }
        } catch (error) {
            if (grid.children.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">خطأ: ${Utils.escapeHTML(error.message)}</div>`;
            }
        }
    }

    static updateStats(tasks) {
        const total = tasks.length;
        const pending = tasks.filter(t => t.status !== 'مكتمل' && t.status !== 'ملغي').length;
        const completed = tasks.filter(t => t.status === 'مكتمل').length;

        document.getElementById('totalTasksCount').textContent = total;
        document.getElementById('pendingTasksCount').textContent = pending;
        document.getElementById('completedTasksCount').textContent = completed;
    }

    static startAutoRefresh() {
        setInterval(() => this.loadTasks(), 60000);
    }

    static renderTasks(tasks) {
        const grid = document.getElementById('tasksGrid');

        if (!tasks || tasks.length === 0) {
            grid.innerHTML = `
                <div class="card" style="grid-column: 1/-1; text-align:center; padding:4rem; background: var(--glass-bg);">
                    <i class="fas fa-clipboard-check" style="font-size:4rem; margin-bottom:1.5rem; color:var(--brand-primary); opacity:0.3;"></i>
                    <h3 style="font-weight:800; font-size:1.5rem;">لا توجد مهام حالية</h3>
                    <p style="color:var(--text-muted);">ابدأ بإضافة مهامك اليومية لتبدأ في تتبع إنتاجيتك بشكل احترافي.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = tasks.map(task => {
            const isCompleted = task.status === 'مكتمل';
            const priorityColor = this.getPriorityColor(task.priority);

            return `
            <div class="card task-card" style="display:flex; flex-direction:column; gap:1.25rem; opacity: ${isCompleted ? '0.75' : '1'}; border-right: 5px solid ${priorityColor};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:var(--text-main); ${isCompleted ? 'text-decoration:line-through;' : ''}">${Utils.escapeHTML(task.title)}</h3>
                        <div style="display:flex; flex-wrap:wrap; gap:0.8rem; margin-top:0.5rem; font-size:0.8rem;">
                             <span style="color:var(--brand-primary); font-weight:700;">
                                <i class="fas fa-gavel"></i> ${task.case_title ? Utils.escapeHTML(task.case_title) : 'مهمة عامة'}
                             </span>
                             <span style="color:var(--text-muted); font-weight:600;">
                                <i class="fas fa-user"></i> ${task.assigned_to_name ? Utils.escapeHTML(task.assigned_to_name) : 'غير مسندة'}
                             </span>
                        </div>
                    </div>
                    <div class="badge" style="background:${priorityColor}22; color:${priorityColor}; padding:4px 10px; border-radius:8px; font-size:0.7rem; font-weight:800; border: 1px solid ${priorityColor}33;">
                        ${Utils.escapeHTML(task.priority)}
                    </div>
                </div>

                <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; min-height:40px;">
                    ${task.description ? Utils.escapeHTML(task.description) : 'لا يوجد وصف لهذه المهمة...'}
                </p>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:0.6rem; color:var(--text-muted); font-size:0.85rem; font-weight:600;">
                        <i class="far fa-calendar-alt"></i>
                        <span>${task.due_date ? new Date(task.due_date).toLocaleDateString('ar-SA') : 'بدون تاريخ'}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        ${!isCompleted ? `
                            <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--success); border-color:var(--success)44;" data-card-action="toggle-status" data-id="${task.id}" data-status="مكتمل" title="إكمال">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--warning); border-color:var(--warning)44;" data-card-action="toggle-status" data-id="${task.id}" data-status="قيد الانتظار" title="إعادة فتح">
                                <i class="fas fa-undo"></i>
                            </button>
                        `}
                        <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--brand-primary);" data-card-action="edit" data-id="${task.id}" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--danger);" data-card-action="delete" data-id="${task.id}" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    static getPriorityColor(p) {
        const colors = {
            'عاجل': '#ef4444',
            'عالي': '#ef4444',
            'متوسط': '#f59e0b',
            'منخفض': '#3b82f6'
        };
        return colors[p] || '#94a3b8';
    }

    static openTaskModal() {
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        document.getElementById('modalTitle').textContent = 'إضافة مهمة جديدة';
        document.getElementById('taskModal').style.display = 'flex';
    }

    static closeTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.getElementById('taskForm').reset();
    }

    static async saveTask() {
        const id = document.getElementById('taskId').value;
        const case_id = document.getElementById('taskCase').value;
        const assigned_to = document.getElementById('taskAssignedTo').value;

        const data = {
            title: document.getElementById('taskTitle').value,
            case_id: case_id || null, // Fix: Use null instead of empty string
            assigned_to: assigned_to || null,
            priority: document.getElementById('taskPriority').value,
            due_date: document.getElementById('taskDueDate').value || null,
            description: document.getElementById('taskDescription').value
        };

        if (!data.title) {
            Utils.showMessage('يرجى إدخال عنوان المهمة', 'error');
            return;
        }

        try {
            Utils.showLoading('جاري الحفظ...');
            let res;
            if (id) {
                res = await API.put(`/tasks/${id}`, data);
            } else {
                res = await API.post('/tasks', data);
            }

            Utils.hideLoading();

            if (res.success) {
                Utils.showMessage('تم حفظ المهمة بنجاح', 'success');
                this.closeTaskModal();
                this.loadTasks();
            } else {
                Utils.showMessage(res.message || 'خطأ في حفظ المهمة', 'error');
            }
        } catch (e) {
            Utils.hideLoading();
            console.error('Save task error:', e);
            Utils.showMessage('حدث خطأ أثناء الاتصال بالخادم', 'error');
        }
    }

    static async toggleStatus(id, status) {
        try {
            const res = await API.put(`/tasks/${id}`, { status });
            if (res.success) {
                this.loadTasks();
            }
        } catch (e) {
            console.error('Update status error:', e);
        }
    }

    static async editTask(id) {
        try {
            const res = await API.get(`/tasks/${id}`);
            if (res.success) {
                const task = res.data;
                document.getElementById('taskId').value = task.id;
                document.getElementById('taskTitle').value = task.title;
                document.getElementById('taskCase').value = task.case_id || '';
                document.getElementById('taskAssignedTo').value = task.assigned_to || '';
                document.getElementById('taskPriority').value = task.priority;
                document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
                document.getElementById('taskDescription').value = task.description || '';

                document.getElementById('modalTitle').textContent = 'تعديل المهمة';
                document.getElementById('taskModal').style.display = 'flex';
            }
        } catch (e) {
            console.error('Edit task error:', e);
        }
    }

    static async deleteTask(id) {
        if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
        try {
            const res = await API.delete(`/tasks/${id}`);
            if (res.success) {
                Utils.showMessage('تم حذف المهمة بنجاح', 'success');
                this.loadTasks();
            }
        } catch (e) {
            console.error('Delete task error:', e);
        }
    }
}

window.TasksManager = TasksManager;
document.addEventListener('DOMContentLoaded', () => TasksManager.init());
