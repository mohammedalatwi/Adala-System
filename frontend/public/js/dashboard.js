/**
 * dashboard.js - إدارة لوحة التحكم
 */

class DashboardManager {
    constructor() {
        this.stats = {};
        this.user = null;
        this.init();
    }

    async init() {
        try {
            await this.loadUserInfo();
            await this.loadDashboardData();
            this.setupEventListeners();
            console.log('✅ Dashboard manager initialized');
        } catch (error) {
            console.error('❌ Error initializing dashboard:', error);
        }
    }

    // ✅ تحميل معلومات المستخدم
    async loadUserInfo() {
        try {
            // محاكاة بيانات المستخدم (سيتم استبدالها بـ API حقيقي)
            this.user = {
                id: 1,
                full_name: 'مدير النظام',
                username: 'admin',
                email: 'admin@adala.com',
                role: 'admin',
                specialization: 'إدارة النظام'
            };
            
            this.updateUserInterface();
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    // ✅ تحديث واجهة المستخدم
    updateUserInterface() {
        if (this.user) {
            const userNameElement = document.getElementById('userName');
            const userFullNameElement = document.getElementById('userFullName');
            const userRoleElement = document.getElementById('userRole');
            const welcomeTitle = document.getElementById('welcomeTitle');

            if (userNameElement) {
                userNameElement.innerHTML = `<i class="fas fa-user"></i> ${this.user.full_name}`;
            }
            if (userFullNameElement) {
                userFullNameElement.textContent = this.user.full_name;
            }
            if (userRoleElement) {
                userRoleElement.textContent = this.user.role;
            }
            if (welcomeTitle) {
                welcomeTitle.textContent = `مرحباً ${this.user.full_name}!`;
            }
        }
    }

    // ✅ تحميل بيانات لوحة التحكم
    async loadDashboardData() {
        try {
            // محاكاة بيانات الإحصائيات (سيتم استبدالها بـ API حقيقي)
            this.stats = {
                total_cases: 12,
                total_clients: 8,
                upcoming_sessions: 5,
                total_documents: 23,
                active_cases: 8,
                completed_cases: 3,
                urgent_cases: 2
            };

            this.updateStats();
            this.loadRecentActivities();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    // ✅ تحديث الإحصائيات
    updateStats() {
        const statsElements = {
            'totalCases': this.stats.total_cases,
            'totalClients': this.stats.total_clients,
            'upcomingSessions': this.stats.upcoming_sessions,
            'totalDocuments': this.stats.total_documents,
            'activeCases': this.stats.active_cases,
            'completedCases': this.stats.completed_cases,
            'urgentCases': this.stats.urgent_cases
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // ✅ تحميل الأنشطة الحديثة
    loadRecentActivities() {
        // محاكاة البيانات (سيتم استبدالها بـ API حقيقي)
        const activities = [
            {
                type: 'case',
                message: 'تم إنشاء قضية جديدة',
                details: 'قضية تعويض عن ضرر مادي',
                time: 'منذ 5 دقائق',
                icon: 'fa-gavel'
            },
            {
                type: 'session',
                message: 'تم جدولة جلسة جديدة',
                details: 'جلسة نظر قضية التعويض',
                time: 'منذ ساعة',
                icon: 'fa-calendar-alt'
            },
            {
                type: 'document',
                message: 'تم رفع مستند جديد',
                details: 'مذكرة دفاع في قضية النزاع العقاري',
                time: 'منذ 3 ساعات',
                icon: 'fa-file-contract'
            }
        ];

        this.renderActivities(activities);
    }

    // ✅ عرض الأنشطة
    renderActivities(activities) {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-details">${activity.details}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
    }

    // ✅ إعداد مستمعي الأحداث
    setupEventListeners() {
        // تسجيل الخروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // تحديث البيانات
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // الإجراءات السريعة
        this.setupQuickActions();
    }

    // ✅ إعداد الإجراءات السريعة
    setupQuickActions() {
        const actions = {
            'addCase': '/cases?action=new',
            'addSession': '/sessions?action=new',
            'addClient': '/clients?action=new',
            'viewDocuments': '/documents'
        };

        Object.entries(actions).forEach(([action, url]) => {
            const element = document.getElementById(action);
            if (element) {
                element.addEventListener('click', () => {
                    window.location.href = url;
                });
            }
        });
    }

    // ✅ تسجيل الخروج
    async logout() {
        if (confirm('هل تريد تسجيل الخروج؟')) {
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (response.ok) {
                    window.location.href = '/login';
                } else {
                    throw new Error('فشل في تسجيل الخروج');
                }
            } catch (error) {
                console.error('Logout error:', error);
                Utils.showMessage('فشل في تسجيل الخروج', 'error');
            }
        }
    }

    // ✅ تحديث البيانات
    async refreshData() {
        Utils.showMessage('جاري تحديث البيانات...', 'info');
        
        try {
            await this.loadDashboardData();
            Utils.showMessage('تم تحديث البيانات بنجاح', 'success', 2000);
        } catch (error) {
            console.error('Error refreshing data:', error);
            Utils.showMessage('فشل في تحديث البيانات', 'error');
        }
    }

    // ✅ تحميل الإشعارات
    async loadNotifications() {
        try {
            // محاكاة الإشعارات (سيتم استبدالها بـ API حقيقي)
            const notifications = [
                {
                    id: 1,
                    title: 'جلسة قريبة',
                    message: 'جلسة قضية التعويض غداً الساعة 10:00 صباحاً',
                    type: 'warning',
                    read: false,
                    time: 'منذ ساعة'
                },
                {
                    id: 2,
                    title: 'مستند جديد',
                    message: 'تم رفع مستند جديد في قضية النزاع العقاري',
                    type: 'info',
                    read: false,
                    time: 'منذ 3 ساعات'
                }
            ];

            this.renderNotifications(notifications);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    // ✅ عرض الإشعارات
    renderNotifications(notifications) {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        container.innerHTML = notifications.map(notif => `
            <div class="notification-item ${!notif.read ? 'unread' : ''}">
                <div class="notification-icon">
                    <i class="fas fa-${notif.type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-message">${notif.message}</div>
                    <div class="notification-time">${notif.time}</div>
                </div>
                ${!notif.read ? '<div class="notification-badge"></div>' : ''}
            </div>
        `).join('');
    }
}

// ✅ تهيئة Dashboard Manager عند تحميل الصفحة
let dashboardManager;

document.addEventListener('DOMContentLoaded', () => {
    dashboardManager = new DashboardManager();
});

// ✅ جعل Dashboard Manager متاحاً globally
window.dashboardManager = dashboardManager;