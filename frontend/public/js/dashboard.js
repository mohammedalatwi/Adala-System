/**
 * dashboard.js - إدارة لوحة التحكم مع اتصال حقيقي
 */

class DashboardManager {

    // ✅ تحميل بيانات لوحة التحكم
    static async loadDashboardData(silent = false) {
        try {
            if (!silent) Utils.showLoading('جاري تحميل البيانات...');
            const result = await API.get('/dashboard/data');

            if (result.success) {
                this.updateDashboardUI(result.data);

                if (result.data.user) {
                    document.getElementById('userName').textContent = result.data.user.full_name;
                    document.getElementById('userRole').textContent = result.data.user.role;
                    document.getElementById('userAvatar').textContent = result.data.user.full_name.charAt(0).toUpperCase();
                }
            }

            this.updateGreeting();
            await this.loadCharts();
            if (!silent) Utils.hideLoading();

        } catch (error) {
            console.error('Failed to load dashboard:', error);
            if (!silent) Utils.hideLoading();
        }
    }

    static async refresh() {
        console.log('🔄 Refreshing dashboard data...');
        await this.loadDashboardData(true);
    }

    static startAutoRefresh() {
        // Refresh every 60 seconds
        setInterval(() => this.refresh(), 60000);
    }

    // ✅ تحميل وعرض الرسوم البيانية
    static async loadCharts() {
        try {
            const result = await API.get('/dashboard/charts');
            if (result.success && result.data) {
                this.renderCasesTrendChart(result.data.monthlyCases);
                this.renderCasesStatusChart(result.data.casesByStatus);
            }
        } catch (error) {
            console.error('Failed to load charts:', error);
        }
    }

    static renderCasesTrendChart(data = []) {
        const ctx = document.getElementById('casesTrendChart')?.getContext('2d');
        if (!ctx) return;

        // Destroy previous instance
        if (window.casesTrendChartInstance) {
            window.casesTrendChartInstance.destroy();
        }

        const months = [...data].map(d => d.month).reverse();
        const counts = [...data].map(d => d.count).reverse();

        window.casesTrendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'عدد القضايا الجديدة',
                    data: counts,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    static renderCasesStatusChart(data = []) {
        const ctx = document.getElementById('casesStatusChart')?.getContext('2d');
        if (!ctx) return;

        // Destroy previous instance
        if (window.casesStatusChartInstance) {
            window.casesStatusChartInstance.destroy();
        }

        const labels = data.map(d => d.status);
        const counts = data.map(d => d.count);
        const colors = {
            'جديد': '#3b82f6',
            'قيد الدراسة': '#06b6d4',
            'قيد التنفيذ': '#f59e0b',
            'منتهي': '#10b981',
            'ملغي': '#ef4444'
        };

        window.casesStatusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: labels.map(l => colors[l] || '#cbd5e1'),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // ✅ تحديث واجهة لوحة التحكم
    static updateDashboardUI(data) {
        // تحديث الإحصائيات
        if (data.stats) {
            this.updateStats(data.stats);
        }

        // تحديث الجلسات القادمة
        if (data.upcomingSessions) {
            this.renderUpcomingSessions(data.upcomingSessions);
        }

        // تحديث القضايا الحديثة
        if (data.recentCases) {
            this.renderRecentCases(data.recentCases);
        }

        // تحديث الإشعارات
        if (data.notifications) {
            this.renderNotifications(data.notifications);
        }

        // تحديث الأنشطة الحديثة
        if (data.recentActivities) {
            this.renderRecentActivities(data.recentActivities);
        }

        // تحديث المهام الحديثة
        if (data.recentTasks) {
            this.renderRecentTasks(data.recentTasks);
        }

        // تحديث وقت آخر تحديث
        this.updateLastUpdateTime(data.lastUpdate);

        console.log('✅ تم تحديث لوحة التحكم بالبيانات الحقيقية');
    }

    // ✅ تحديث الإحصائيات
    static updateStats(stats) {
        const statsElements = {
            'totalCases': stats.total_cases || 0,
            'totalClients': stats.total_clients || 0,
            'upcomingSessions': stats.upcoming_sessions || 0,
            'totalDocuments': stats.total_documents || 0,
            'activeCases': stats.in_progress_cases || 0,
            'completedCases': stats.completed_cases || 0,
            'totalLawyers': stats.total_lawyers || 0,
            'statsSessions': stats.upcoming_sessions || 0
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                this.animateValue(element, 0, value, 1000);
            }
        });
    }

    // ✅ تأثير العد المتدرج للإحصائيات (يدعم اللاحقة)
    static animateValue(element, start, end, duration, suffix = '') {
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // تأثير ease-out
            const currentValue = Math.floor(start + (end - start) * (1 - Math.pow(1 - progress, 3)));

            element.textContent = currentValue.toLocaleString('ar-SA') + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    }

    // ✅ عرض الجلسات القادمة
    static renderUpcomingSessions(sessions) {
        const container = document.getElementById('upcomingSessionsList');
        if (!container) return;

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:4rem; text-align:center; color:var(--text-muted);">
                    <i class="fas fa-calendar-times" style="font-size:3rem; margin-bottom:1rem; opacity:0.3;"></i>
                    <p>لا توجد جلسات قادمة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = sessions.map(session => `
            <div class="list-item" onclick="window.location.href='/sessions?id=${session.id}'" style="
                display: flex; flex-direction: column; gap: 0.5rem; padding: 1.25rem; border-radius: 14px; 
                background: var(--bg-surface); border: 1px solid var(--border-color); cursor: pointer; transition: var(--transition-base);
                margin-bottom: 1rem; box-shadow: var(--shadow-sm);">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="font-weight:800; color:var(--text-main); font-size:1rem;">${session.case_title || 'جلسة بدون عنوان'}</div>
                    <span class="badge" style="background:var(--brand-primary)11; color:var(--brand-primary); padding:4px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; border:1px solid var(--brand-primary)22;">
                        ${this.formatSessionDate(session.session_date)}
                    </span>
                </div>
                <div style="display:flex; gap:1.25rem; font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
                    <span style="display:flex; align-items:center; gap:0.4rem;"><i class="fas fa-clock" style="color:var(--brand-primary);"></i> ${this.formatTime(session.session_date)}</span>
                    <span style="display:flex; align-items:center; gap:0.4rem;"><i class="fas fa-map-marker-alt" style="color:var(--danger);"></i> ${session.location || 'غير محدد'}</span>
                </div>
            </div>
        `).join('');
    }

    // ✅ عرض القضايا الحديثة
    static renderRecentCases(cases) {
        const container = document.getElementById('recentCasesList');
        if (!container) return;

        if (!cases || cases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gavel"></i>
                    <p>لا توجد قضايا حديثة</p>
                    <small>سيتم عرض أحدث القضايا هنا</small>
                </div>
            `;
            return;
        }

        container.innerHTML = cases.map(caseItem => `
            <div class="list-item" onclick="window.location.href='/cases?id=${caseItem.id}'">
                <div class="list-item-header">
                    <div class="list-item-title">${caseItem.title || 'قضية بدون عنوان'}</div>
                    <span class="badge badge-${this.getCaseBadgeType(caseItem.status)}">
                        ${caseItem.status || 'غير محدد'}
                    </span>
                </div>
                <div class="list-item-meta">
                    <span><i class="fas fa-hashtag"></i> ${caseItem.case_number || 'بدون رقم'}</span>
                    <span><i class="fas fa-user"></i> ${caseItem.client_name || 'عميل غير محدد'}</span>
                    <span><i class="fas fa-calendar"></i> ${this.formatDate(caseItem.created_at)}</span>
                </div>
                ${caseItem.lawyer_name ? `<div class="list-item-lawyer"><i class="fas fa-user-tie"></i> ${caseItem.lawyer_name}</div>` : ''}
            </div>
        `).join('');
    }

    // ✅ عرض الإشعارات
    static renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <p>لا توجد إشعارات</p>
                    <small>سيتم عرض الإشعارات الهامة هنا</small>
                </div>
            `;
            return;
        }

        container.innerHTML = notifications.map(notif => `
            <div class="list-item notification-item ${notif.is_read ? '' : 'unread'}" onclick="DashboardManager.markNotificationAsRead(${notif.id}, this)">
                <div class="list-item-header">
                    <div class="list-item-title">${notif.title || 'إشعار'}</div>
                    <span class="badge badge-${notif.type || 'info'}">${notif.type || 'معلومات'}</span>
                </div>
                <div class="list-item-meta">
                    <span>${notif.message || 'لا يوجد محتوى'}</span>
                </div>
                <div class="notification-time">
                    <i class="fas fa-clock"></i> ${this.formatRelativeTime(notif.created_at)}
                    ${!notif.is_read ? '<span class="notification-dot"></span>' : ''}
                </div>
            </div>
        `).join('');
    }

    // ✅ عرض الأنشطة الحديثة
    static renderRecentActivities(activities) {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>لا توجد أنشطة حديثة</p>
                    <small>سيتم عرض سجل الأنشطة هنا</small>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(activity => `
            <div class="activity-item" style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color); display:flex; gap:1rem; transition:var(--transition-base);">
                <div class="activity-icon" style="width:40px; height:40px; border-radius:12px; background:var(--bg-body); display:flex; align-items:center; justify-content:center; color:var(--brand-primary); border:1px solid var(--border-color);">
                    <i class="fas ${this.getActivityIcon(activity.action_type)}" style="font-size:1.1rem;"></i>
                </div>
                <div class="activity-content" style="flex:1;">
                    <div class="activity-message" style="font-weight:700; font-size:0.95rem; margin-bottom:0.25rem; color:var(--text-main);">${activity.description || 'نشاط'}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="activity-user" style="font-size:0.85rem; color:var(--text-muted);">بواسطة: ${activity.user_name || 'مستخدم'}</div>
                        <div class="activity-time" style="font-size:0.8rem; color:var(--brand-primary); font-weight:700; background:var(--brand-primary)11; padding:2px 8px; border-radius:6px;">${this.formatRelativeTime(activity.created_at)}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ✅ عرض المهام الحديثة
    static renderRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks"></i>
                    <p>لا توجد مهام حالية</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="list-item" onclick="window.location.href='/tasks'" style="padding:1.25rem; border-bottom:1px solid var(--border-color); cursor:pointer; transition:var(--transition-base); background:var(--bg-surface); margin-bottom:0.5rem; border-radius:12px; border:1px solid transparent;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                    <div class="list-item-title" style="font-weight:800; color:var(--text-main); font-size:0.95rem;">${task.title}</div>
                    <span class="badge" style="background:${this.getPriorityColor(task.priority)}11; color:${this.getPriorityColor(task.priority)}; padding:2px 10px; border-radius:8px; font-size:0.75rem; font-weight:800; border:1px solid ${this.getPriorityColor(task.priority)}33;">
                        ${task.priority}
                    </span>
                </div>
                <div class="list-item-meta" style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:var(--text-muted);">
                    <span style="display:flex; align-items:center; gap:0.4rem;"><i class="fas fa-gavel" style="color:var(--brand-primary);"></i> ${task.case_title || 'عام'}</span>
                    <span style="display:flex; align-items:center; gap:0.4rem; font-weight:700;"><i class="fas fa-calendar-alt" style="color:var(--warning);"></i> ${task.due_date ? new Date(task.due_date).toLocaleDateString('ar-SA') : 'بدون موعد'}</span>
                </div>
            </div>
        `).join('');
    }

    static getPriorityColor(p) {
        if (p === 'عاجل' || p === 'عالي') return '#ef4444';
        if (p === 'متوسط') return '#f59e0b';
        return '#3b82f6';
    }

    // ✅ تعليم إشعار كمقروء
    static async markNotificationAsRead(notificationId, element) {
        try {
            const result = await API.put(`/dashboard/notifications/${notificationId}/read`);
            if (result.success) {
                if (element) {
                    element.classList.remove('unread');
                    const dot = element.querySelector('.notification-dot');
                    if (dot) dot.remove();
                }
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // ✅ تحديث وقت آخر تحديث
    static updateLastUpdateTime(timestamp) {
        const updateElement = document.getElementById('lastUpdateTime');
        if (updateElement && timestamp) {
            const date = new Date(timestamp);
            updateElement.textContent = `آخر تحديث: ${date.toLocaleTimeString('ar-SA')}`;
        }
    }

    // ✅ مساعدات التنسيق
    static getSessionBadgeType(session) {
        if (!session.session_date) return 'secondary';

        const now = new Date();
        const sessionDate = new Date(session.session_date);
        const diffTime = sessionDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) return 'danger';
        if (diffDays <= 3) return 'warning';
        return 'primary';
    }

    static getCaseBadgeType(status) {
        const statusMap = {
            'جديد': 'primary',
            'قيد الدراسة': 'info',
            'قيد التنفيذ': 'warning',
            'منتهي': 'success',
            'ملغي': 'danger'
        };
        return statusMap[status] || 'secondary';
    }

    static getActivityIcon(actionType) {
        const iconMap = {
            'login': 'fa-sign-in-alt',
            'logout': 'fa-sign-out-alt',
            'create': 'fa-plus-circle',
            'update': 'fa-edit',
            'delete': 'fa-trash-alt',
            'register': 'fa-user-plus'
        };
        return iconMap[actionType] || 'fa-circle';
    }

    static formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        return new Date(dateString).toLocaleDateString('ar-SA');
    }

    static formatTime(dateString) {
        if (!dateString) return 'غير محدد';
        return new Date(dateString).toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatSessionDate(dateString) {
        if (!dateString) return 'غير محدد';

        const now = new Date();
        const sessionDate = new Date(dateString);
        const diffTime = sessionDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'اليوم';
        if (diffDays === 1) return 'غداً';
        if (diffDays === 2) return 'بعد غد';
        if (diffDays <= 7) return `بعد ${diffDays} أيام`;

        return sessionDate.toLocaleDateString('ar-SA');
    }

    static formatRelativeTime(dateString) {
        if (!dateString) return 'غير محدد';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        if (diffDays === 1) return 'أمس';
        if (diffDays < 7) return `منذ ${diffDays} أيام`;

        return date.toLocaleDateString('ar-SA');
    }

    // ✅ تحديث رسالة الترحيب بناءً على الوقت
    static updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'مرحباً بك';
        if (hour < 12) greeting = 'صباح الخير';
        else if (hour < 18) greeting = 'مساء الخير';
        else greeting = 'طاب مساؤك';

        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) {
            const userName = document.getElementById('userName')?.textContent || 'أستاذ';
            welcomeEl.innerHTML = `${greeting}، ${userName.split(' ')[0]} 👋`;
        }
    }

    // ✅ تأثير عد متدرج (محسن لدعم اللاحقة)
    static animateValue(obj, start, end, duration, suffix = '') {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = Math.floor(progress * (end - start) + start);
            obj.textContent = val.toLocaleString() + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // ✅ عرض الأخطاء
    static showError(message) {
        Utils.showMessage(message, 'error');
    }
}

// ✅ جعل DashboardManager متاحاً globally
window.DashboardManager = DashboardManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check Auth first
    API.get('/auth/status').then(res => {
        if (!res.authenticated) {
            window.location.href = '/login';
        } else {
            DashboardManager.loadDashboardData();
            DashboardManager.startAutoRefresh();
        }
    });

    // زر تسجيل الخروج يُهيّأ مركزياً في Utils.initGlobal()
});