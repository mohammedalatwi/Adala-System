/**
 * utils.js - أدوات مساعدة لنظام عدالة
 */

class Utils {

    // ✅ إظهار رسالة للمستخدم
    static showMessage(message, type = 'info', duration = 5000) {
        // إزالة الرسائل القديمة
        const existingAlerts = document.querySelectorAll('.global-alert');
        existingAlerts.forEach(alert => alert.remove());

        // إنشاء الرسالة الجديدة
        const alert = document.createElement('div');
        alert.className = `global-alert alert alert-${type} animate-fadeIn`;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            box-shadow: var(--shadow-xl);
            animation: slideIn 0.3s ease-out;
        `;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        alert.innerHTML = `
            <div class="alert-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="alert-content">
                <strong>${this.capitalize(type)}!</strong> ${message}
            </div>
            <button class="alert-close" onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                font-size: 1.25rem;
                cursor: pointer;
                color: inherit;
                opacity: 0.7;
            ">&times;</button>
        `;

        document.body.appendChild(alert);

        // إزالة تلقائية بعد المدة المحددة
        if (duration > 0) {
            setTimeout(() => {
                if (alert.parentElement) {
                    alert.style.animation = 'fadeIn 0.3s ease-out reverse';
                    setTimeout(() => alert.remove(), 300);
                }
            }, duration);
        }

        return alert;
    }

    // ✅ إظهار نافذة التحميل
    static showLoading(message = 'جاري التحميل...') {
        let overlay = document.getElementById('globalLoadingOverlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9998;
                backdrop-filter: blur(5px);
            `;

            overlay.innerHTML = `
                <div class="loading-spinner" style="
                    background: white;
                    padding: 2rem;
                    border-radius: var(--border-radius-lg);
                    text-align: center;
                    box-shadow: var(--shadow-xl);
                    min-width: 200px;
                ">
                    <i class="fas fa-spinner fa-spin fa-2x" style="color: var(--primary-color); margin-bottom: 1rem;"></i>
                    <div class="loading-message">${message}</div>
                </div>
            `;

            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            const messageEl = overlay.querySelector('.loading-message');
            if (messageEl) messageEl.textContent = message;
        }
    }

    // ✅ إخفاء التحميل
    static hideLoading() {
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // ✅ تنسيق التاريخ
    static formatDate(dateString, options = {}) {
        if (!dateString) return 'غير محدد';

        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Riyadh'
        };

        return date.toLocaleDateString('ar-SA', { ...defaultOptions, ...options });
    }

    // ✅ تنسيق الوقت
    static formatTime(dateString) {
        if (!dateString) return 'غير محدد';

        const date = new Date(dateString);
        return date.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Riyadh'
        });
    }

    // ✅ تنسيق التاريخ والوقت
    static formatDateTime(dateString) {
        if (!dateString) return 'غير محدد';

        const date = new Date(dateString);
        return date.toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Riyadh'
        });
    }

    // ✅ الوقت النسبي (منذ)
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
        if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;

        return this.formatDate(dateString);
    }

    // ✅ تحويل أول حرف إلى كبير
    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // ✅ تقليم النص وإضافة ...
    static truncate(text, length = 50) {
        if (!text) return '';
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    // ✅ تنسيق الأرقام
    static formatNumber(number) {
        if (typeof number !== 'number') return '0';
        return new Intl.NumberFormat('ar-SA').format(number);
    }

    // ✅ التحقق من البريد الإلكتروني
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
    }

    // ✅ التحقق من رقم الهاتف
    static isValidPhone(phone) {
        if (!phone) return true; // اختياري

        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        return phoneRegex.test(phone.trim());
    }

    // ✅ نسخ إلى الحافظة
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showMessage('تم النسخ إلى الحافظة', 'success', 2000);
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showMessage('فشل في النسخ', 'error');
            return false;
        }
    }

    // ✅ تهيئة الأدوات العالمية
    static initGlobal() {
        this.loadBranding();
        this.applyRoleRestrictions();
        console.log('✨ Utils Initialized');
    }

    /**
     * إخفاء العناصر غير المصرح بها بناءً على دور المستخدم
     */
    static async applyRoleRestrictions() {
        try {
            const response = await fetch('/api/auth/status', { credentials: 'include' });
            const data = await response.json();

            if (data.authenticated && data.user) {
                const role = data.user.role;

                // إخفاء الروابط غير المسموحة للمتدرب
                if (role === 'trainee') {
                    const restrictedSelectors = [
                        'a[href="/financial"]',
                        'a[href="/reports"]',
                        'a[href="/settings"]',
                        'a[href="/team"]'
                    ];
                    restrictedSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
                    });
                }

                // إخفاء الروابط للعميل
                if (role === 'client') {
                    const restrictedSelectors = [
                        'a[href="/dashboard"]',
                        'a[href="/cases"]',
                        'a[href="/clients"]',
                        'a[href="/sessions"]',
                        'a[href="/documents"]',
                        'a[href="/financial"]',
                        'a[href="/reports"]',
                        'a[href="/tasks"]',
                        'a[href="/settings"]',
                        'a[href="/team"]'
                    ];
                    restrictedSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
                    });
                }
            }
        } catch (error) {
            console.error('Error applying role restrictions:', error);
        }
    }

    /**
     * تحميل شعار واسم المكتب وتطبيقها عالمياً
     */
    static async loadBranding() {
        try {
            // محاولة الحصول من الذاكرة المؤقتة للجلسة أولاً لتقليل طلبات API
            let settings = JSON.parse(sessionStorage.getItem('adala_settings'));

            if (!settings) {
                const response = await fetch('/api/offices/settings');
                const data = await response.json();
                if (data.success) {
                    settings = {
                        firm_name: data.data.name,
                        firm_logo: data.data.logo_url,
                        primary_color: data.data.settings?.primary_color || '#2563eb'
                    };
                    sessionStorage.setItem('adala_settings', JSON.stringify(settings));
                }
            }

            if (settings) {
                this.applyBranding(settings);
            }
        } catch (error) {
            console.error('Error loading branding:', error);
        }
    }

    static applyBranding(settings) {
        const { firm_name, firm_logo, primary_color } = settings;

        // تطبيق الألوان (اختياري حالياً)
        if (primary_color) {
            document.documentElement.style.setProperty('--brand-primary', primary_color);
        }

        // تطبيق الاسم في جميع العناصر التي تحمل كلاس brand-name
        document.querySelectorAll('.brand-name').forEach(el => {
            el.textContent = firm_name || 'نظام عدالة';
        });

        // تطبيق اللوجو في جميع الحاويات المخصصة
        document.querySelectorAll('.brand-logo-container').forEach(container => {
            if (firm_logo) {
                container.innerHTML = `<img src="${firm_logo}" alt="${firm_name}">`;
            } else {
                container.innerHTML = `<i class="fas fa-balance-scale"></i>`;
            }
        });

        // تحديث عنوان الصفحة إذا لم يكن مخصصاً
        if (firm_name && document.title.includes('نظام عدالة')) {
            document.title = document.title.replace('نظام عدالة', firm_name);
        }
    }

    // ✅ تنزيل الملف
    static downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ✅ إعادة توجيه مع رسالة
    static redirect(url, message = null, messageType = 'info') {
        if (message) {
            sessionStorage.setItem('redirectMessage', JSON.stringify({
                text: message,
                type: messageType
            }));
        }
        window.location.href = url;
    }

    // ✅ عرض رسالة إعادة التوجيه
    static showRedirectMessage() {
        const messageData = sessionStorage.getItem('redirectMessage');
        if (messageData) {
            try {
                const { text, type } = JSON.parse(messageData);
                this.showMessage(text, type);
                sessionStorage.removeItem('redirectMessage');
            } catch (error) {
                console.error('Error parsing redirect message:', error);
            }
        }
    }

    // ✅ إدارة الحالة المحلية
    static setLocalState(key, value) {
        try {
            localStorage.setItem(`adala_${key}`, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    static getLocalState(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(`adala_${key}`);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    static removeLocalState(key) {
        try {
            localStorage.removeItem(`adala_${key}`);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    // ✅ إدارة الجلسة
    static setSessionState(key, value) {
        try {
            sessionStorage.setItem(`adala_${key}`, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to sessionStorage:', error);
            return false;
        }
    }

    static getSessionState(key, defaultValue = null) {
        try {
            const item = sessionStorage.getItem(`adala_${key}`);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from sessionStorage:', error);
            return defaultValue;
        }
    }

    // ✅ التحقق من الصلاحيات
    static hasPermission(user, requiredRole) {
        if (!user || !user.role) return false;

        const roleHierarchy = {
            'admin': 3,
            'lawyer': 2,
            'assistant': 1
        };

        const userLevel = roleHierarchy[user.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    // ✅ معالجة الأخطاء
    static handleError(error, userMessage = 'حدث خطأ غير متوقع') {
        console.error('Application Error:', error);

        let message = userMessage;

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            message = 'فشل في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
        } else if (error.message) {
            message = error.message;
        }

        this.showMessage(message, 'error');

        // تسجيل الخطأ للتصحيح
        if (window.console && console.error) {
            console.error('Error Details:', error);
        }
    }

    // ✅ طلبات HTTP محسنة
    static async apiRequest(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        try {
            this.showLoading('جاري المعالجة...');

            const response = await fetch(url, mergedOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            this.handleError(error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // ✅ Debounce للمدخلات
    static debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    // ✅ توليد معرف فريد
    static generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }

    // ✅ التحقق من صيغة الملف
    static isValidFileType(file, allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']) {
        return allowedTypes.includes(file.type);
    }

    // ✅ التحقق من حجم الملف
    static isValidFileSize(file, maxSizeMB = 5) {
        return file.size <= maxSizeMB * 1024 * 1024;
    }
}

// ✅ جعل الأدوات متاحة globally
window.Utils = Utils;


console.log('✅ أدوات نظام عدالة جاهزة للاستخدام');

// ✅ تهيئة النظام عند تحميل أي صفحة
document.addEventListener('DOMContentLoaded', () => {
    // عرض رسائل إعادة التوجيه
    Utils.showRedirectMessage();

    // تشغيل تهيئة البراند
    Utils.initGlobal();

    // إضافة أنماط للرسائل العائمة (Alerts)
    if (!document.querySelector('#global-styles')) {
        const style = document.createElement('style');
        style.id = 'global-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .global-alert { animation: slideIn 0.3s ease-out; }
            .global-alert .alert-close:hover { opacity: 1; }
        `;
        document.head.appendChild(style);
    }
});