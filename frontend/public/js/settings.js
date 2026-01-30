class SettingsManager {
    constructor() {
        this.brandingForm = document.getElementById('brandingForm');
        this.firmNameInput = document.getElementById('firm_name');
        this.primaryColorInput = document.getElementById('primary_color');
        this.logoInput = document.getElementById('logoInput');
        this.logoPreview = document.getElementById('logoPreviewContainer');
        this.resetBtn = document.getElementById('resetBranding');

        // Notification Settings Elements
        this.notificationForm = document.getElementById('notificationForm');
        this.inAppToggle = document.getElementById('in_app_enabled');

        this.init();
    }

    async init() {
        if (!await this.checkAccess()) return;
        this.loadCurrentSettings();
        this.loadNotificationSettings();
        this.setupEventListeners();
    }

    async checkAccess() {
        const data = await API.get('/auth/status');
        if (!data || !data.authenticated || !['admin', 'lawyer'].includes(data.user.role)) {
            Utils.redirect('/dashboard', 'عذراً، هذه الصفحة للمدراء والمحامين فقط', 'error');
            return false;
        }
        return true;
    }

    async loadCurrentSettings() {
        try {
            const data = await API.get('/settings');
            if (data.success) {
                const s = data.settings;
                if (this.firmNameInput) this.firmNameInput.value = s.firm_name || '';
                if (this.primaryColorInput) this.primaryColorInput.value = s.primary_color || '#2563eb';

                if (s.firm_logo && this.logoPreview) {
                    this.logoPreview.innerHTML = `<img src="${s.firm_logo}" alt="Logo">
                        <div class="upload-overlay" onclick="document.getElementById('logoInput').click()"><i class="fas fa-camera"></i></div>`;
                }
            }
        } catch (error) {
            Utils.showMessage('فشل في تحميل الإعدادات', 'error');
        }
    }

    async loadNotificationSettings() {
        try {
            const data = await API.get('/settings/notifications');
            if (data.success && data.settings) {
                const s = data.settings;
                const intervals = JSON.parse(s.reminder_intervals || '[]');

                document.querySelectorAll('input[name="intervals"]').forEach(cb => {
                    cb.checked = intervals.includes(cb.value);
                });

                if (this.inAppToggle) {
                    this.inAppToggle.checked = !!s.email_enabled;
                }
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }

    setupEventListeners() {
        if (this.logoInput) {
            this.logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        }

        if (this.brandingForm) {
            this.brandingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.resetToDefault());
        }

        if (this.notificationForm) {
            this.notificationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNotificationSettings();
            });
        }
    }

    async handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            Utils.showLoading('جاري رفع الشعار...');
            const response = await fetch('/api/offices/logo', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();

            if (data.success) {
                Utils.showMessage('تم تحديث الشعار بنجاح');
                sessionStorage.removeItem('adala_settings');
                // Update preview
                if (this.logoPreview) {
                    this.logoPreview.innerHTML = `<img src="${data.logo_url}" alt="Preview">
                        <div class="upload-overlay" onclick="document.getElementById('logoInput').click()"><i class="fas fa-camera"></i></div>`;
                }
                Utils.loadBranding();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            Utils.showMessage('فشل الرفع: ' + error.message, 'error');
        } finally {
            Utils.hideLoading();
        }
    }

    async saveSettings() {
        const updates = {
            name: this.firmNameInput.value.trim(),
            address: document.getElementById('office_address')?.value.trim(),
            phone: document.getElementById('office_phone')?.value.trim(),
            email: document.getElementById('office_email')?.value.trim(),
            settings: {
                primary_color: this.primaryColorInput.value
            }
        };

        try {
            Utils.showLoading('جاري حفظ الإعدادات...');
            const data = await API.put('/offices/settings', updates);
            if (data.success) {
                Utils.showMessage('تم حفظ إعدادات المكتب بنجاح');
                sessionStorage.removeItem('adala_settings');
                setTimeout(() => location.reload(), 1000);
            }
        } catch (error) {
            Utils.showMessage('فشل الحفظ: ' + error.message, 'error');
        } finally {
            Utils.hideLoading();
        }
    }

    async resetToDefault() {
        if (!confirm('هل أنت متأكد من إعادة الإعدادات الافتراضية؟')) return;

        const defaults = {
            name: 'نظام عدالة',
            settings: {
                primary_color: '#2563eb'
            }
        };

        try {
            await API.put('/offices/settings', defaults);
            sessionStorage.removeItem('adala_settings');
            location.reload();
        } catch (error) {
            Utils.showMessage('فشل إعادة التعيين', 'error');
        }
    }

    async saveNotificationSettings() {
        const selectedIntervals = Array.from(document.querySelectorAll('input[name="intervals"]:checked'))
            .map(cb => cb.value);

        const updates = {
            reminder_intervals: selectedIntervals,
            email_enabled: this.inAppToggle.checked ? 1 : 0
        };

        try {
            Utils.showLoading('جاري حفظ إعدادات التنبيهات...');
            const data = await API.post('/settings/notifications', updates);
            if (data.success) {
                Utils.showMessage('تم حفظ إعدادات التنبيهات بنجاح');
            }
        } catch (error) {
            Utils.showMessage('فشل حفظ التنبيهات: ' + error.message, 'error');
        } finally {
            Utils.hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new SettingsManager());
