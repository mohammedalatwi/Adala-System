/**
 * cases.js - إدارة القضايا
 */

class CasesManager {
    constructor() {
        this.cases = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {
            search: '',
            status: '',
            case_type: '',
            priority: '',
            page: 1,
            limit: 10
        };
        this.isEditing = false;
        this.currentCaseId = null;
        this.init();
    }

    async init() {
        try {
            await this.loadCases();
            await this.loadClients();
            await this.loadLawyers();
            this.setupEventListeners();
            this.updateStats();
            console.log('✅ Cases manager initialized');
        } catch (error) {
            console.error('❌ Error initializing cases manager:', error);
            Utils.showMessage('فشل في تحميل البيانات', 'error');
        }
    }

    // ✅ تحميل القضايا
    async loadCases() {
        try {
            Utils.showLoader();
            
            const queryString = new URLSearchParams(this.filters).toString();
            const response = await fetch(`/api/cases?${queryString}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('فشل في جلب البيانات');
            }

            const data = await response.json();
            
            if (data.success) {
                this.cases = data.data;
                this.totalPages = data.pagination.pages;
                this.currentPage = data.pagination.page;
                this.renderCases();
                this.renderPagination();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading cases:', error);
            Utils.showMessage('فشل في تحميل القضايا', 'error');
            this.showEmptyState();
        } finally {
            Utils.hideLoader();
        }
    }

    // ✅ تحميل العملاء
    async loadClients() {
        try {
            const response = await fetch('/api/clients?limit=100', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderClientOptions(data.data);
                }
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    // ✅ تحميل المحامين
    async loadLawyers() {
        try {
            const response = await fetch('/api/users?role=lawyer', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderLawyerOptions(data.data);
                }
            }
        } catch (error) {
            console.error('Error loading lawyers:', error);
        }
    }

    // ✅ عرض القضايا في الجدول
    renderCases() {
        const tbody = document.getElementById('casesTableBody');
        const emptyState = document.getElementById('emptyState');

        if (this.cases.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        tbody.innerHTML = this.cases.map(caseItem => `
            <tr>
                <td>
                    <strong>${caseItem.case_number}</strong>
                </td>
                <td>
                    <div class="case-title">${caseItem.title}</div>
                    ${caseItem.description ? `<small class="text-muted">${caseItem.description.substring(0, 50)}...</small>` : ''}
                </td>
                <td>
                    <div>${caseItem.client_name}</div>
                    <small class="text-muted">${caseItem.client_phone}</small>
                </td>
                <td>
                    <span class="badge badge-primary">${caseItem.case_type}</span>
                </td>
                <td>
                    <span class="case-status status-${this.getStatusClass(caseItem.status)}">
                        <i class="fas ${this.getStatusIcon(caseItem.status)}"></i>
                        ${caseItem.status}
                    </span>
                </td>
                <td>
                    <span class="priority-badge priority-${this.getPriorityClass(caseItem.priority)}">
                        <i class="fas ${this.getPriorityIcon(caseItem.priority)}"></i>
                        ${caseItem.priority}
                    </span>
                </td>
                <td>
                    ${caseItem.start_date ? Utils.formatDate(caseItem.start_date) : '---'}
                </td>
                <td>
                    <div class="d-flex align-center gap-1">
                        <i class="fas fa-calendar-alt text-info"></i>
                        <span>${caseItem.sessions_count || 0}</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" onclick="casesManager.viewCase(${caseItem.id})" title="عرض التفاصيل">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-edit" onclick="casesManager.editCase(${caseItem.id})" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="casesManager.deleteCase(${caseItem.id})" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ✅ عرض الترقيم
    renderPagination() {
        const pagination = document.getElementById('pagination');
        
        if (this.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // زر السابق
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-link" onclick="casesManager.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        // أرقام الصفحات
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                paginationHTML += `<button class="page-link ${i === this.currentPage ? 'active' : ''}" 
                    onclick="casesManager.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                paginationHTML += '<span class="page-link">...</span>';
            }
        }

        // زر التالي
        if (this.currentPage < this.totalPages) {
            paginationHTML += `<button class="page-link" onclick="casesManager.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-left"></i>
            </button>`;
        }

        pagination.innerHTML = paginationHTML;
    }

    // ✅ الانتقال لصفحة
    goToPage(page) {
        this.filters.page = page;
        this.loadCases();
    }

    // ✅ تطبيق الفلاتر
    applyFilters() {
        this.filters.search = document.getElementById('searchInput').value;
        this.filters.status = document.getElementById('statusFilter').value;
        this.filters.case_type = document.getElementById('typeFilter').value;
        this.filters.priority = document.getElementById('priorityFilter').value;
        this.filters.page = 1;
        
        this.loadCases();
    }

    // ✅ إعادة تعيين الفلاتر
    resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('priorityFilter').value = '';
        
        this.filters = {
            search: '',
            status: '',
            case_type: '',
            priority: '',
            page: 1,
            limit: 10
        };
        
        this.loadCases();
    }

    // ✅ فتح Modal إضافة قضية
    openAddModal() {
        this.isEditing = false;
        this.currentCaseId = null;
        
        document.getElementById('modalTitle').textContent = 'إضافة قضية جديدة';
        document.getElementById('caseForm').reset();
        this.openModal();
    }

    // ✅ فتح Modal تعديل قضية
    async editCase(caseId) {
        try {
            Utils.showLoader();
            
            const response = await fetch(`/api/cases/${caseId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('فشل في جلب بيانات القضية');
            }

            const data = await response.json();
            
            if (data.success) {
                this.isEditing = true;
                this.currentCaseId = caseId;
                
                document.getElementById('modalTitle').textContent = 'تعديل القضية';
                this.fillForm(data.data);
                this.openModal();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading case:', error);
            Utils.showMessage('فشل في تحميل بيانات القضية', 'error');
        } finally {
            Utils.hideLoader();
        }
    }

    // ✅ تعبئة النموذج بالبيانات
    fillForm(caseData) {
        document.getElementById('case_number').value = caseData.case_number || '';
        document.getElementById('title').value = caseData.title || '';
        document.getElementById('case_type').value = caseData.case_type || '';
        document.getElementById('client_id').value = caseData.client_id || '';
        document.getElementById('lawyer_id').value = caseData.lawyer_id || '';
        document.getElementById('status').value = caseData.status || 'جديد';
        document.getElementById('priority').value = caseData.priority || 'متوسط';
        document.getElementById('description').value = caseData.description || '';
        document.getElementById('court_name').value = caseData.court_name || '';
        document.getElementById('judge_name').value = caseData.judge_name || '';
        document.getElementById('start_date').value = caseData.start_date || '';
        document.getElementById('expected_end_date').value = caseData.expected_end_date || '';
    }

    // ✅ حفظ القضية
    async saveCase() {
        try {
            const formData = new FormData(document.getElementById('caseForm'));
            const caseData = Object.fromEntries(formData);
            
            // تنظيف البيانات
            Object.keys(caseData).forEach(key => {
                if (caseData[key] === '') {
                    delete caseData[key];
                }
            });

            // التحقق من البيانات المطلوبة
            if (!caseData.case_number || !caseData.title || !caseData.case_type || !caseData.client_id || !caseData.lawyer_id) {
                Utils.showMessage('يرجى ملء جميع الحقول المطلوبة', 'warning');
                return;
            }

            Utils.showLoader();

            const url = this.isEditing ? `/api/cases/${this.currentCaseId}` : '/api/cases';
            const method = this.isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(caseData)
            });

            const data = await response.json();

            if (data.success) {
                Utils.showMessage(data.message, 'success');
                this.closeModal();
                this.loadCases();
                this.updateStats();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error saving case:', error);
            Utils.showMessage(error.message || 'فشل في حفظ القضية', 'error');
        } finally {
            Utils.hideLoader();
        }
    }

    // ✅ حذف القضية
    async deleteCase(caseId) {
        if (!confirm('هل أنت متأكد من حذف هذه القضية؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        try {
            Utils.showLoader();

            const response = await fetch(`/api/cases/${caseId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                Utils.showMessage(data.message, 'success');
                this.loadCases();
                this.updateStats();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error deleting case:', error);
            Utils.showMessage(error.message || 'فشل في حذف القضية', 'error');
        } finally {
            Utils.hideLoader();
        }
    }

    // ✅ عرض تفاصيل القضية
    viewCase(caseId) {
        window.location.href = `/case-details.html?id=${caseId}`;
    }

    // ✅ تحديث الإحصائيات
    async updateStats() {
        try {
            const response = await fetch('/api/cases/stats', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderStats(data.data);
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // ✅ عرض الإحصائيات
    renderStats(stats) {
        const totalCases = stats.byStatus.reduce((sum, item) => sum + item.count, 0);
        const activeCases = stats.byStatus.filter(item => 
            ['جديد', 'قيد الدراسة', 'قيد التنفيذ'].includes(item.status)
        ).reduce((sum, item) => sum + item.count, 0);
        const urgentCases = stats.byPriority.find(item => item.priority === 'عاجل')?.count || 0;
        const completedCases = stats.byStatus.find(item => item.status === 'منتهي')?.count || 0;

        document.getElementById('totalCases').textContent = totalCases;
        document.getElementById('activeCases').textContent = activeCases;
        document.getElementById('urgentCases').textContent = urgentCases;
        document.getElementById('completedCases').textContent = completedCases;
    }

    // ✅ عرض خيارات العملاء
    renderClientOptions(clients) {
        const select = document.getElementById('client_id');
        select.innerHTML = '<option value="">اختر العميل</option>' +
            clients.map(client => 
                `<option value="${client.id}">${client.full_name} - ${client.phone}</option>`
            ).join('');
    }

    // ✅ عرض خيارات المحامين
    renderLawyerOptions(lawyers) {
        const select = document.getElementById('lawyer_id');
        select.innerHTML = '<option value="">اختر المحامي</option>' +
            lawyers.map(lawyer => 
                `<option value="${lawyer.id}">${lawyer.full_name} - ${lawyer.specialization}</option>`
            ).join('');
    }

    // ✅ فتح Modal
    openModal() {
        document.getElementById('caseModal').style.display = 'block';
    }

    // ✅ إغلاق Modal
    closeModal() {
        document.getElementById('caseModal').style.display = 'none';
        document.getElementById('caseForm').reset();
    }

    // ✅ إعداد مستمعي الأحداث
    setupEventListeners() {
        // إضافة قضية جديدة
        document.getElementById('addCaseBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('addFirstCase').addEventListener('click', () => this.openAddModal());

        // تطبيق الفلاتر
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

        // البحث أثناء الكتابة
        let searchTimeout;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.applyFilters();
            }, 500);
        });

        // Modal events
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveCaseBtn').addEventListener('click', () => this.saveCase());

        // إغلاق Modal بالنقر خارج المحتوى
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('caseModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // إدخال البيانات في النموذج
        document.getElementById('caseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCase();
        });
    }

    // ✅ دوال مساعدة للحالة
    getStatusClass(status) {
        const statusMap = {
            'جديد': 'new',
            'قيد الدراسة': 'in-progress',
            'قيد التنفيذ': 'in-progress',
            'منتهي': 'completed',
            'ملغي': 'cancelled'
        };
        return statusMap[status] || 'new';
    }

    getStatusIcon(status) {
        const iconMap = {
            'جديد': 'fa-plus-circle',
            'قيد الدراسة': 'fa-search',
            'قيد التنفيذ': 'fa-cog',
            'منتهي': 'fa-check-circle',
            'ملغي': 'fa-times-circle'
        };
        return iconMap[status] || 'fa-file';
    }

    getPriorityClass(priority) {
        const priorityMap = {
            'عاجل': 'urgent',
            'عالي': 'high',
            'متوسط': 'medium',
            'منخفض': 'low'
        };
        return priorityMap[priority] || 'medium';
    }

    getPriorityIcon(priority) {
        const iconMap = {
            'عاجل': 'fa-exclamation-triangle',
            'عالي': 'fa-arrow-up',
            'متوسط': 'fa-minus',
            'منخفض': 'fa-arrow-down'
        };
        return iconMap[priority] || 'fa-minus';
    }

    // ✅ عرض حالة عدم وجود بيانات
    showEmptyState() {
        const tbody = document.getElementById('casesTableBody');
        const emptyState = document.getElementById('emptyState');
        
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
    }
}

// ✅ تهيئة Cases Manager
let casesManager;

document.addEventListener('DOMContentLoaded', () => {
    casesManager = new CasesManager();
});

// ✅ جعل Cases Manager متاحاً globally
window.casesManager = casesManager;