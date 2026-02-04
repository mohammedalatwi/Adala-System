/**
 * reports.js - Reports & Analytics Logic
 */
class ReportsManager {
    static charts = {};

    static async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadAllReports();
        console.log('📊 Reports Manager Ready');
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
    }

    static async refresh() {
        Utils.showLoading('جاري تحديث البيانات...');
        await this.loadAllReports();
        Utils.hideLoading();
        Utils.showMessage('تم تحديث البيانات بنجاح', 'success');
    }

    static async loadAllReports() {
        try {
            const [systemStats, lawyerPerformance, sessionStats] = await Promise.all([
                API.get('/reports/system-stats'),
                API.get('/reports/performance'),
                API.get('/reports/sessions')
            ]);

            if (systemStats.success) this.renderSystemOverview(systemStats.data);
            if (systemStats.success) this.renderCasesChart(systemStats.data.cases);
            if (lawyerPerformance.success) this.renderLawyerChart(lawyerPerformance.data.lawyers);
            if (sessionStats.success) this.renderSessionsChart(sessionStats.data.stats);

        } catch (error) {
            console.error('Failed to load reports:', error);
        }
    }

    static renderSystemOverview(stats) {
        const overview = document.getElementById('statsOverview');
        const cards = [
            { title: 'إجمالي المحامين', value: stats.users?.lawyer || 0, icon: 'fa-user-tie', color: 'var(--brand-primary)', bg: 'rgba(37, 99, 235, 0.1)' },
            { title: 'إجمالي العملاء', value: stats.clients?.active || 0, icon: 'fa-users', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
            { title: 'إجمالي القضايا', value: Object.values(stats.cases || {}).reduce((a, b) => a + b, 0), icon: 'fa-gavel', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
            { title: 'المستندات الرقمية', value: stats.documents?.total || 0, icon: 'fa-file-alt', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
        ];

        overview.innerHTML = cards.map(c => `
            <div class="card stat-card" style="padding:1.5rem; transition: var(--transition-base);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:var(--text-muted); font-size:0.9rem; font-weight:700; margin-bottom:0.5rem;">${c.title}</div>
                        <div style="font-size:2rem; font-weight:800; color:var(--text-main);">${c.value}</div>
                    </div>
                    <div style="width:55px; height:55px; background:${c.bg}; border-radius:14px; color:${c.color}; display:flex; align-items:center; justify-content:center; font-size:1.5rem; box-shadow: 0 4px 10px ${c.color}22;">
                        <i class="fas ${c.icon}"></i>
                    </div>
                </div>
            </div>
        `).join('');
    }

    static renderCasesChart(casesStats) {
        const ctx = document.getElementById('casesChart').getContext('2d');
        if (this.charts.cases) this.charts.cases.destroy();

        const labels = Object.keys(casesStats || {});
        const data = Object.values(casesStats || {});

        this.charts.cases = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Cairo' } } }
                }
            }
        });
    }

    static renderLawyerChart(lawyers) {
        const ctx = document.getElementById('lawyerChart').getContext('2d');
        if (this.charts.lawyers) this.charts.lawyers.destroy();

        const labels = lawyers.map(l => l.full_name);
        const data = lawyers.map(l => l.success_rate);

        this.charts.lawyers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'نسبة الإنجاز %',
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 100 }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    static renderSessionsChart(stats) {
        const ctx = document.getElementById('sessionsChart').getContext('2d');
        if (this.charts.sessions) this.charts.sessions.destroy();

        this.charts.sessions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['إجمالي', 'قادمة', 'منتهية', 'متأخرة'],
                datasets: [{
                    label: 'عدد الجلسات',
                    data: [stats.total, stats.upcoming, stats.completed, stats.overdue],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { font: { family: 'Cairo' } }
                }
            }
        });
    }
}

window.Reports = ReportsManager;
document.addEventListener('DOMContentLoaded', () => ReportsManager.init());
