/**
 * tasks.js - Tasks Management Logic
 */
class TasksManager {
    static async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadCases();
        await this.loadTasks();

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
        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await API.post('/auth/logout');
            window.location.href = '/login';
        });

        document.getElementById('searchInput').addEventListener('input', Utils.debounce(() => this.loadTasks(), 500));

        // Modal outside click
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('taskModal')) {
                this.closeTaskModal();
            }
        });
    }

    static async loadCases() {
        try {
            const res = await API.get('/cases?limit=100');
            if (res.success) {
                const cases = res.data.cases || res.data;
                const options = cases.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
                document.getElementById('taskCase').insertAdjacentHTML('beforeend', options);
            }
        } catch (e) {
            console.error('Load cases error:', e);
        }
    }

    static async loadTasks() {
        const grid = document.getElementById('tasksGrid');
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

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
                // Backend now returns { tasks, pagination } in data
                this.renderTasks(result.data.tasks);
            }
        } catch (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">خطأ: ${error.message}</div>`;
        }
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
            const priorityKey = this.getPriorityKey(task.priority);
            const isCompleted = task.status === 'مكتمل';

            return `
            <div class="card task-card" style="display:flex; flex-direction:column; gap:1.25rem; opacity: ${isCompleted ? '0.75' : '1'}; border-right: 5px solid ${this.getPriorityColor(task.priority)};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
                    <div style="flex:1;">
                        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-main); ${isCompleted ? 'text-decoration:line-through;' : ''}">${task.title}</h3>
                        <div style="margin-top:0.4rem; font-size:0.85rem; color:var(--brand-primary); font-weight:700;">
                             <i class="fas fa-gavel"></i> ${task.case_title || 'مهمة عامة'}
                        </div>
                    </div>
                    <div class="badge" style="background:${this.getPriorityColor(task.priority)}22; color:${this.getPriorityColor(task.priority)}; padding:4px 10px; border-radius:8px; font-size:0.7rem; font-weight:800; border: 1px solid ${this.getPriorityColor(task.priority)}33;">
                        ${task.priority}
                    </div>
                </div>

                <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; min-height:48px;">
                    ${task.description || 'لا يوجد وصف معمق لهذه المهمة...'}
                </p>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem; border-top:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:0.6rem; color:var(--text-muted); font-size:0.85rem; font-weight:600;">
                        <i class="far fa-calendar-alt"></i>
                        <span>${task.due_date ? new Date(task.due_date).toLocaleDateString('ar-SA') : 'بدون تاريخ'}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        ${!isCompleted ? `
                            <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--success); border-color:var(--success)44;" onclick="TasksManager.toggleStatus(${task.id}, 'مكتمل')" title="إكمال">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--warning); border-color:var(--warning)44;" onclick="TasksManager.toggleStatus(${task.id}, 'قيد الانتظار')" title="إعادة فتح">
                                <i class="fas fa-undo"></i>
                            </button>
                        `}
                        <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--brand-primary);" onclick="TasksManager.editTask(${task.id})" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="width:34px; height:34px; padding:0; border-radius:10px; color:var(--danger);" onclick="TasksManager.deleteTask(${task.id})" title="حذف">
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

    static getPriorityKey(p) {
        if (p === 'عاجل' || p === 'عالي') return 'high';
        if (p === 'متوسط') return 'medium';
        return 'low';
    }

    static getPriorityBadge(p) {
        const colors = {
            'عاجل': '#ef4444',
            'عالي': '#f87171',
            'متوسط': '#f59e0b',
            'منخفض': '#3b82f6'
        };
        const color = colors[p] || '#666';
        return `<span style="background:${color}22; color:${color}; padding:2px 8px; border-radius:12px; font-weight:600;">${p}</span>`;
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
        const data = {
            title: document.getElementById('taskTitle').value,
            case_id: document.getElementById('taskCase').value,
            priority: document.getElementById('taskPriority').value,
            due_date: document.getElementById('taskDueDate').value,
            description: document.getElementById('taskDescription').value
        };

        if (!data.title) {
            Utils.showMessage('يرجى إدخال عنوان المهمة', 'error');
            return;
        }

        try {
            let res;
            if (id) {
                res = await API.put(`/tasks/${id}`, data);
            } else {
                res = await API.post('/tasks', data);
            }

            if (res.success) {
                Utils.showMessage('تم حفظ المهمة بنجاح', 'success');
                this.closeTaskModal();
                this.loadTasks();
            }
        } catch (e) {
            console.error('Save task error:', e);
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
                document.getElementById('taskPriority').value = task.priority;
                document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split(' ')[0] : '';
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
