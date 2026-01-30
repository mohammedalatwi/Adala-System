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
                const options = res.data.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
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
                this.renderTasks(result.data);
            }
        } catch (error) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">خطأ: ${error.message}</div>`;
        }
    }

    static renderTasks(tasks) {
        const grid = document.getElementById('tasksGrid');

        if (!tasks || tasks.length === 0) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
                    <i class="fas fa-clipboard-check" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <h3>لا توجد مهام</h3>
                    <p>قم بإضافة مهمة جديدة لتبدأ</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = tasks.map(task => `
            <div class="card task-card priority-${this.getPriorityKey(task.priority)} ${task.status === 'مكتمل' ? 'status-completed' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                    <div>
                        <h4 style="margin:0;">${task.title}</h4>
                        <div style="font-size:0.8rem; color:var(--text-muted);">للقضية: ${task.case_title || 'عام'}</div>
                    </div>
                    <div style="font-size:0.8rem;">
                        ${this.getPriorityBadge(task.priority)}
                    </div>
                </div>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1.5rem; min-height:40px;">
                    ${task.description || 'لا يوجد وصف'}
                </p>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:0.8rem; color:var(--text-muted);">
                        <i class="far fa-calendar-alt"></i> ${task.due_date ? new Date(task.due_date).toLocaleDateString('ar-SA') : 'بدون موعد'}
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        ${task.status !== 'مكتمل' ? `
                            <button class="btn btn-sm btn-outline" style="color:var(--success);" onclick="TasksManager.toggleStatus(${task.id}, 'مكتمل')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-outline" style="color:var(--warning);" onclick="TasksManager.toggleStatus(${task.id}, 'قيد الانتظار')">
                                <i class="fas fa-undo"></i>
                            </button>
                        `}
                        <button class="btn btn-sm btn-outline" onclick="TasksManager.editTask(${task.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" style="color:var(--danger);" onclick="TasksManager.deleteTask(${task.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
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
