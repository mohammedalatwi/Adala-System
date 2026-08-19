/**
 * register.js - منطق صفحة إنشاء الحساب (كان مضمّناً كسكربت inline في register.html،
 * نُقل إلى ملف خارجي حتى يعمل تحت سياسة أمان محتوى صارمة بدون 'unsafe-inline')
 */
class RegisterManager {
    constructor() {
        this.validationState = {
            full_name: false,
            username: false,
            email: false,
            password: false,
            confirm_password: false,
            role: false
        };

        // إنشاء دوال debounce
        this.debouncedCheckUsername = Utils.debounce((username) => {
            this.checkUsernameAvailability(username);
        }, 500);

        this.debouncedCheckEmail = Utils.debounce((email) => {
            this.checkEmailAvailability(email);
        }, 500);

        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.updateSubmitButton();
        console.log('✅ مدير التسجيل جاهز');
    }

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });
            const data = await response.json();

            if (data.authenticated) {
                Utils.redirect('/dashboard', 'أنت مسجل الدخول بالفعل!', 'info');
            }
        } catch (error) {
            console.log('المستخدم غير مسجل الدخول');
        }
    }

    setupEventListeners() {
        // الاسم الكامل
        document.getElementById('full_name').addEventListener('input', (e) => {
            this.validateFullName(e.target.value);
        });

        // اسم المستخدم
        document.getElementById('username').addEventListener('input', (e) => {
            const username = e.target.value.trim();
            this.debouncedCheckUsername(username);
        });

        // البريد الإلكتروني
        document.getElementById('email').addEventListener('input', (e) => {
            const email = e.target.value.trim();
            this.debouncedCheckEmail(email);
        });

        // كلمة المرور
        document.getElementById('password').addEventListener('input', (e) => {
            this.validatePassword(e.target.value);
            this.validatePasswordMatch();
        });

        // تأكيد كلمة المرور
        document.getElementById('confirm_password').addEventListener('input', () => {
            this.validatePasswordMatch();
        });

        // الدور
        document.getElementById('role').addEventListener('change', (e) => {
            this.validateRole(e.target.value);
        });

        // إظهار/إخفاء كلمة المرور
        document.getElementById('togglePassword').addEventListener('click', () => {
            this.togglePasswordVisibility('password', 'togglePassword');
        });

        document.getElementById('toggleConfirmPassword').addEventListener('click', () => {
            this.togglePasswordVisibility('confirm_password', 'toggleConfirmPassword');
        });

        // إرسال النموذج
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    // ✅ التحقق من الاسم الكامل
    validateFullName(value) {
        const trimmed = value.trim();
        const isValid = trimmed.length >= 2 && trimmed.length <= 100;

        this.updateFieldValidation('full_name', isValid,
            isValid ? '✓ الاسم صالح' : '✗ يجب أن يكون بين 2 و 100 حرف');

        this.updateFieldStyle('full_name', isValid);
        return isValid;
    }

    // ✅ التحقق من اسم المستخدم
    async checkUsernameAvailability(username) {
        if (username.length < 3) {
            this.updateFieldValidation('username', false,
                '✗ يجب أن يكون 3 أحرف على الأقل');
            this.updateFieldStyle('username', false);
            return false;
        }

        if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username)) {
            this.updateFieldValidation('username', false,
                '✗ مسموح: عربي، إنجليزي، أرقام و _ فقط');
            this.updateFieldStyle('username', false);
            return false;
        }

        try {
            const encodedUsername = encodeURIComponent(username);
            const response = await fetch(`/api/auth/check-username/${encodedUsername}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('فشل في الاتصال بالخادم');

            const data = await response.json();

            if (data.available) {
                this.updateFieldValidation('username', true, '✓ اسم المستخدم متاح');
                this.updateFieldStyle('username', true);
                return true;
            } else {
                this.updateFieldValidation('username', false, '✗ اسم المستخدم موجود مسبقاً');
                this.updateFieldStyle('username', false);
                return false;
            }
        } catch (error) {
            console.error('Error checking username:', error);
            this.updateFieldValidation('username', false, '✗ فشل في التحقق');
            this.updateFieldStyle('username', false);
            return false;
        }
    }

    // ✅ التحقق من البريد الإلكتروني
    async checkEmailAvailability(email) {
        if (!Utils.isValidEmail(email)) {
            this.updateFieldValidation('email', false, '✗ البريد الإلكتروني غير صالح');
            this.updateFieldStyle('email', false);
            return false;
        }

        try {
            const encodedEmail = encodeURIComponent(email);
            const response = await fetch(`/api/auth/check-email/${encodedEmail}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('فشل في الاتصال بالخادم');

            const data = await response.json();

            if (data.available) {
                this.updateFieldValidation('email', true, '✓ البريد الإلكتروني متاح');
                this.updateFieldStyle('email', true);
                return true;
            } else {
                this.updateFieldValidation('email', false, '✗ البريد الإلكتروني موجود مسبقاً');
                this.updateFieldStyle('email', false);
                return false;
            }
        } catch (error) {
            console.error('Error checking email:', error);
            this.updateFieldValidation('email', false, '✗ فشل في التحقق');
            this.updateFieldStyle('email', false);
            return false;
        }
    }

    // ✅ التحقق من قوة كلمة المرور
    validatePassword(password) {
        if (password.length === 0) {
            this.updateFieldValidation('password', false, '✗ كلمة المرور مطلوبة');
            this.updateFieldStyle('password', false);
            this.updatePasswordStrength(0, 'غير محددة');
            return false;
        }

        if (password.length < 6) {
            this.updateFieldValidation('password', false, '✗ يجب أن تكون 6 أحرف على الأقل');
            this.updateFieldStyle('password', false);
            this.updatePasswordStrength(0, 'ضعيفة جداً');
            return false;
        }

        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        let strength, message;
        if (score <= 2) {
            strength = 'weak';
            message = 'ضعيفة';
        } else if (score <= 4) {
            strength = 'medium';
            message = 'متوسطة';
        } else {
            strength = 'strong';
            message = 'قوية';
        }

        const isValid = score >= 2;
        this.updateFieldValidation('password', isValid,
            isValid ? `✓ قوة الكلمة: ${message}` : `✗ قوة الكلمة: ${message}`);
        this.updateFieldStyle('password', isValid);
        this.updatePasswordStrength(score, message);

        return isValid;
    }

    // ✅ التحقق من تطابق كلمة المرور
    validatePasswordMatch() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        if (confirmPassword.length === 0) {
            this.updateFieldValidation('confirm_password', false, '✗ تأكيد كلمة المرور مطلوب');
            this.updateFieldStyle('confirm_password', false);
            return false;
        }

        if (password === confirmPassword) {
            this.updateFieldValidation('confirm_password', true, '✓ كلمات المرور متطابقة');
            this.updateFieldStyle('confirm_password', true);
            return true;
        } else {
            this.updateFieldValidation('confirm_password', false, '✗ كلمات المرور غير متطابقة');
            this.updateFieldStyle('confirm_password', false);
            return false;
        }
    }

    // ✅ التحقق من الدور
    validateRole(role) {
        const isValid = role !== '';
        this.updateFieldValidation('role', isValid,
            isValid ? '✓ تم اختيار الدور' : '✗ يجب اختيار الدور');
        return isValid;
    }

    // ✅ تحديث قوة كلمة المرور
    updatePasswordStrength(score, message) {
        const bar = document.getElementById('passwordStrengthBar');
        const feedback = document.getElementById('passwordFeedback');

        bar.className = 'password-strength-bar';
        if (score <= 2) bar.classList.add('strength-weak');
        else if (score <= 4) bar.classList.add('strength-medium');
        else bar.classList.add('strength-strong');
    }

    // ✅ تحديث حالة الحقل
    updateFieldValidation(field, isValid, message) {
        const feedback = document.getElementById(field + 'Feedback');
        this.validationState[field] = isValid;

        if (feedback) {
            feedback.textContent = message;
            feedback.className = `feedback ${isValid ? 'valid' : 'invalid'}`;

            const icon = feedback.querySelector('i') || document.createElement('i');
            icon.className = `fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-circle'}`;
            if (!feedback.querySelector('i')) {
                feedback.prepend(icon);
            }
        }

        this.updateSubmitButton();
    }

    // ✅ تحديث نمط الحقل
    updateFieldStyle(field, isValid) {
        const input = document.getElementById(field);
        if (input) {
            input.classList.remove('valid', 'invalid');
            if (input.value.trim() !== '') {
                input.classList.add(isValid ? 'valid' : 'invalid');
            }
        }
    }

    // ✅ تحديث زر الإرسال
    updateSubmitButton() {
        const allValid = Object.values(this.validationState).every(Boolean);
        const btn = document.getElementById('registerBtn');

        btn.disabled = !allValid;
        btn.innerHTML = allValid ?
            '<i class="fas fa-user-plus"></i> تأكيد إنشاء الحساب' :
            '<i class="fas fa-lock"></i> يرجى إكمال جميع الحقول';
    }

    // ✅ إظهار/إخفاء كلمة المرور
    togglePasswordVisibility(fieldId, toggleId) {
        const input = document.getElementById(fieldId);
        const toggle = document.getElementById(toggleId);
        const icon = toggle.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    // ✅ معالجة إرسال النموذج
    async handleSubmit() {
        const formData = {
            full_name: document.getElementById('full_name').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            password: document.getElementById('password').value,
            role: document.getElementById('role').value,
            specialization: document.getElementById('specialization').value.trim()
        };

        // التحقق النهائي
        if (!this.isFormValid()) {
            Utils.showMessage('❌ يرجى تصحيح جميع الأخطاء قبل المتابعة', 'error');
            this.shakeForm();
            return;
        }

        await this.registerUser(formData);
    }

    // ✅ التحقق النهائي من النموذج
    isFormValid() {
        return Object.values(this.validationState).every(Boolean);
    }

    // ✅ هز النموذج عند الخطأ
    shakeForm() {
        const form = document.getElementById('registerForm');
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
    }

    // ✅ تسجيل المستخدم
    async registerUser(userData) {
        try {
            Utils.showLoading('جاري إنشاء حسابك...');

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (data.success) {
                Utils.showMessage('✅ تم إنشاء حسابك بنجاح! يتم توجيهك إلى صفحة تسجيل الدخول.', 'success');

                setTimeout(() => {
                    Utils.redirect('/login', 'تم إنشاء حسابك بنجاح. يرجى تسجيل الدخول.', 'success');
                }, 2000);
            } else {
                throw new Error(data.message || 'فشل في إنشاء الحساب');
            }
        } catch (error) {
            console.error('Register error:', error);
            Utils.showMessage('❌ ' + error.message, 'error');
        } finally {
            Utils.hideLoading();
        }
    }
}

// ✅ تهيئة مدير التسجيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    new RegisterManager();
});
