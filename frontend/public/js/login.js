/**
 * login.js - منطق صفحة تسجيل الدخول (كان مضمّناً كسكربت inline في login.html،
 * نُقل إلى ملف خارجي حتى يعمل تحت سياسة أمان محتوى صارمة بدون 'unsafe-inline')
 */
class LoginManager {
    constructor() {
        this.loginForm = document.getElementById('loginForm');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.rememberMe = document.getElementById('rememberMe');
        this.togglePasswordBtn = document.getElementById('togglePassword');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.alertBox = document.getElementById('messageAlert');

        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadRememberedEmail();
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.authenticated) {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            console.log('User not logged in');
        }
    }

    setupEventListeners() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        this.togglePasswordBtn.addEventListener('click', () => {
            const type = this.passwordInput.type === 'password' ? 'text' : 'password';
            this.passwordInput.type = type;
            this.togglePasswordBtn.querySelector('i').className = `fas fa-eye${type === 'text' ? '-slash' : ''}`;
        });
    }

    loadRememberedEmail() {
        const savedEmail = localStorage.getItem('adala_remembered_email');
        if (savedEmail) {
            this.emailInput.value = savedEmail;
            this.rememberMe.checked = true;
        } else {
            // Default for trial
            this.emailInput.value = 'admin@adala.com';
            this.passwordInput.value = 'password123';
        }
    }

    showAlert(message, type = 'error') {
        this.alertBox.textContent = message;
        this.alertBox.className = `alert alert-${type}`;
        this.alertBox.style.display = 'block';

        if (type === 'success') {
            setTimeout(() => {
                this.alertBox.style.display = 'none';
            }, 5000);
        }
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    async handleLogin() {
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.showAlert('يرجى ملء جميع الحقول');
            return;
        }

        try {
            this.showLoading();

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                if (this.rememberMe.checked) {
                    localStorage.setItem('adala_remembered_email', email);
                } else {
                    localStorage.removeItem('adala_remembered_email');
                }

                this.showAlert('تم تسجيل الدخول بنجاح، جاري التحويل...', 'success');

                // توجيه بناءً على الدور
                setTimeout(() => {
                    if (data.user && data.user.role === 'client') {
                        window.location.href = '/portal';
                    } else {
                        window.location.href = '/dashboard';
                    }
                }, 1000);
            } else {
                throw new Error(data.message || 'فشل تسجيل الدخول');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert(error.message);
        } finally {
            this.hideLoading();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});
