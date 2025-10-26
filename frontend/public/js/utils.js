/**
 * utils.js - دوال مساعدة عامة
 */

class Utils {
    // ✅ عرض رسالة للمستخدم
    static showMessage(message, type = 'info', duration = 5000) {
        // إزالة أي رسائل سابقة
        const existingMessages = document.querySelectorAll('.alert-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `alert-message alert-${type}`;
        messageDiv.innerHTML = `
            <div class="alert-content">
                <i class="fas ${this.getMessageIcon(type)}"></i>
                <span>${message}</span>
                <button class="alert-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // إضافة الأنماط إذا لم تكن موجودة
        if (!document.querySelector('#alert-styles')) {
            const styles = document.createElement('style');
            styles.id = 'alert-styles';
            styles.textContent = `
                .alert-message {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 500px;
                    animation: slideInRight 0.3s ease;
                }
                .alert-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.5rem;
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow-lg);
                    color: white;
                    font-weight: 500;
                }
                .alert-info { background: var(--info-color); }
                .alert-success { background: var(--success-color); }
                .alert-warning { background: var(--warning-color); }
                .alert-error { background: var(--danger-color); }
                .alert-close {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    margin-right: auto;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(messageDiv);

        // إزالة الرسالة تلقائياً بعد المدة المحددة
        if (duration > 0) {
            setTimeout(() => {
                if (messageDiv.parentElement) {
                    messageDiv.remove();
                }
            }, duration);
        }

        return messageDiv;
    }

    // ✅ الحصول على أيقونة الرسالة
    static getMessageIcon(type) {
        const icons = {
            'info': 'fa-info-circle',
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-times-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    // ✅ عرض مؤشر التحميل
    static showLoader() {
        let loader = document.getElementById('global-loader');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'global-loader';
            loader.innerHTML = `
                <div class="loader-overlay">
                    <div class="loader-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <div>جاري التحميل...</div>
                    </div>
                </div>
            `;

            // إضافة الأنماط إذا لم تكن موجودة
            if (!document.querySelector('#loader-styles')) {
                const styles = document.createElement('style');
                styles.id = 'loader-styles';
                styles.textContent = `
                    .loader-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                    }
                    .loader-spinner {
                        background: white;
                        padding: 2rem;
                        border-radius: var(--border-radius-lg);
                        text-align: center;
                        box-shadow: var(--shadow-lg);
                    }
                    .loader-spinner i {
                        font-size: 2rem;
                        color: var(--primary-color);
                        margin-bottom: 1rem;
                    }
                `;
                document.head.appendChild(styles);
            }

            document.body.appendChild(loader);
        }

        loader.style.display = 'flex';
    }

    // ✅ إخفاء مؤشر التحميل
    static hideLoader() {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    // ✅ تنسيق التاريخ
    static formatDate(dateString) {
        if (!dateString) return '---';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // ✅ تنسيق التاريخ والوقت
    static formatDateTime(dateString) {
        if (!dateString) return '---';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // ✅ تحويل الحجم إلى صيغة مقروءة
    static formatFileSize(bytes) {
        if (!bytes) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // ✅ التحقق من صحة البريد الإلكتروني
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ✅ التحقق من صحة رقم الهاتف السعودي
    static isValidSaudiPhone(phone) {
        const phoneRegex = /^(05)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
        return phoneRegex.test(phone);
    }

    // ✅ إضافة فواصل للأرقام
    static formatNumber(number) {
        return new Intl.NumberFormat('ar-SA').format(number);
    }

    // ✅ إنشاء معرف فريد
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ✅ نسخ النص للحافظة
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showMessage('تم نسخ النص', 'success', 2000);
            return true;
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showMessage('فشل في نسخ النص', 'error');
            return false;
        }
    }

    // ✅ تحميل البيانات من LocalStorage
    static getFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return defaultValue;
        }
    }

    // ✅ حفظ البيانات في LocalStorage
    static saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    // ✅ إزالة البيانات من LocalStorage
    static removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from storage:', error);
            return false;
        }
    }

    // ✅ إضافة حدث debounce
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ✅ فتح Modal
    static openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    // ✅ إغلاق Modal
    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ✅ التحقق من اتصال الإنترنت
    static checkOnlineStatus() {
        return navigator.onLine;
    }

    // ✅ معالجة الأخطاء
    static handleError(error, userMessage = 'حدث خطأ غير متوقع') {
        console.error('Error:', error);
        
        if (error.response) {
            // خطأ من الخادم
            const serverMessage = error.response.data?.message || userMessage;
            this.showMessage(serverMessage, 'error');
        } else if (error.request) {
            // لا يوجد اتصال بالخادم
            this.showMessage('فشل في الاتصال بالخادم', 'error');
        } else {
            // خطأ آخر
            this.showMessage(userMessage, 'error');
        }
    }
}

// ✅ جعل Utils متاحاً globally
window.Utils = Utils;

// ✅ إعداد مستمعي الأحداث العالمية
document.addEventListener('DOMContentLoaded', function() {
    // إعداد إغلاق الـ Modals
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // إغلاق الـ Modals بالضغط على Esc
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
});