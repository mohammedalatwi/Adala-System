/**
 * my-profile.js - صفحة "إعداداتي" (الملف الشخصي للمستخدم الحالي)
 *
 * تعمل لكل الأدوار: تجلب بيانات صاحب الجلسة من GET /api/users/me وتحفظ التعديلات
 * عبر PUT /api/users/me. الحقول المهنية تظهر للمحامي والمتدرب فقط.
 */
class ProfileManager {
    // الحقول القابلة للتعديل الذاتي — مطابقة تمامًا لقائمة الحقول المسموحة في
    // UserService.updateOwnProfile. أي حقل خارجها يرفضه الخادم بـ400 عبر checkExact،
    // لذا لا تُرسل الصفحة إلا هذه الحقول.
    static EDITABLE_FIELDS = ['full_name', 'phone', 'specialization', 'license_number', 'experience_years', 'bio'];

    // حقول تخص العمل القانوني فقط، فلا معنى لعرضها لمدير المكتب أو لحساب بوابة العميل
    static PROFESSIONAL_FIELDS = ['specialization', 'license_number', 'experience_years', 'bio'];

    static ROLE_LABELS = {
        admin: 'مدير المكتب',
        lawyer: 'محامي',
        trainee: 'متدرب قانوني',
        client: 'عميل (بوابة العملاء)'
    };

    static currentProfile = null;

    // true بين لحظة اكتشاف must_change_password=1 ونجاح تغيير كلمة المرور — يقفل
    // تبويبي "بياناتي الشخصية" و"معلومات الحساب" لأن GET /api/users/me سيُرفض بـ403
    // على أي حال طالما هذا العلم قائم (يحظره requireNoPendingPasswordChange عالميًا)
    static forcedPasswordChange = false;

    static TABS = {
        personal: { view: 'personalView', btn: 'tabPersonal' },
        account: { view: 'accountView', btn: 'tabAccount' },
        password: { view: 'passwordView', btn: 'tabPassword' }
    };

    static async init() {
        this.setupEventListeners();
        await this.loadProfile();
    }

    static setupEventListeners() {
        // بدون onclick مضمّن لتوافق سياسة أمان المحتوى (CSP): تفويض عبر data-action
        document.querySelectorAll('[data-action]').forEach(el => {
            el.addEventListener('click', () => {
                const { action, tab } = el.dataset;
                if (action === 'switch-tab') this.switchTab(tab);
            });
        });

        const form = document.getElementById('profileForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        const resetBtn = document.getElementById('resetProfileBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.currentProfile) {
                    this.fillForm(this.currentProfile);
                    Utils.showMessage('تم التراجع عن التعديلات غير المحفوظة', 'info', 3000);
                }
            });
        }
    }

    static switchTab(tab) {
        // أثناء إجبار تغيير كلمة المرور، الأزرار الأخرى معطّلة بـ disabled أصلاً
        // (فلن تُطلق نقرة)، وهذا التحقق حماية إضافية لأي استدعاء برمجي مباشر
        if (this.forcedPasswordChange && tab !== 'password') return;

        const activeStyle = { background: 'var(--brand-primary)', color: 'white' };
        const idleStyle = { background: 'transparent', color: 'var(--text-muted)' };

        Object.keys(this.TABS).forEach(key => {
            const isActive = key === tab;
            const { view, btn } = this.TABS[key];

            document.getElementById(view).style.display = isActive ? 'block' : 'none';

            const btnEl = document.getElementById(btn);
            Object.assign(btnEl.style, isActive ? activeStyle : idleStyle);
            btnEl.classList.toggle('active', isActive);
        });
    }

    static async loadProfile() {
        try {
            Utils.showLoading('جاري تحميل بياناتك...');

            // GET /api/users/me يُرفض بـ403 عبر requireNoPendingPasswordChange طالما
            // must_change_password=1، لذا نتحقق أولاً عبر /auth/status (مسار مستثنى من
            // الحظر) بدل الاصطدام بذلك الخطأ وعرضه كرسالة عامة غير مفهومة للمستخدم
            const auth = await API.get('/auth/status');
            if (auth && auth.user && auth.user.must_change_password) {
                Utils.hideLoading();
                this.enterForcedPasswordMode();
                return;
            }

            const result = await API.get('/users/me');
            Utils.hideLoading();

            if (!result || !result.success) return;

            this.currentProfile = result.data;
            this.applyRoleVisibility(result.data.role);
            this.fillForm(result.data);
            await this.renderAccountInfo(result.data);
        } catch (error) {
            Utils.hideLoading();
            // API.request يعرض رسالة الخطأ للمستخدم أصلاً، ويبقى التسجيل هنا للتشخيص
            console.error('Failed to load profile:', error);
        }
    }

    static enterForcedPasswordMode() {
        this.forcedPasswordChange = true;

        document.getElementById('passwordRequiredBanner').style.display = 'flex';
        document.getElementById('tabPersonal').disabled = true;
        document.getElementById('tabAccount').disabled = true;

        this.switchTab('password');
    }

    static async exitForcedPasswordMode() {
        this.forcedPasswordChange = false;

        document.getElementById('passwordRequiredBanner').style.display = 'none';
        document.getElementById('tabPersonal').disabled = false;
        document.getElementById('tabAccount').disabled = false;

        await this.loadProfile();
        this.switchTab('personal');
    }

    static applyRoleVisibility(role) {
        const showProfessional = role === 'lawyer' || role === 'trainee';
        document.getElementById('professionalFields').style.display = showProfessional ? 'block' : 'none';

        // حساب بوابة العميل تُخفى عنه كل روابط التنقل الأخرى، فيُظهَر له طريق العودة لبوابته
        if (role === 'client') {
            const portalLink = document.getElementById('portalBackLink');
            if (portalLink) portalLink.style.display = 'flex';
        }
    }

    static fillForm(profile) {
        // إسناد إلى input.value وليس innerHTML، فلا حاجة لـ escapeHTML هنا — بل إن
        // استخدامها سيُفسد البيانات (اسم فيه & يصبح &amp; ثم يُحفظ كذلك بقاعدة البيانات).
        this.EDITABLE_FIELDS.forEach(field => {
            const input = document.getElementById(field);
            if (input) input.value = profile[field] === null || profile[field] === undefined ? '' : profile[field];
        });
    }

    static async renderAccountInfo(profile) {
        const officeName = await this.fetchOfficeName();

        const statusClass = profile.is_active ? 'is-active' : 'is-inactive';
        const statusIcon = profile.is_active ? 'fa-circle-check' : 'fa-circle-xmark';
        const statusLabel = profile.is_active ? 'نشط' : 'معطّل';

        const rows = [
            { icon: 'fa-user-tag', label: 'الدور', value: this.ROLE_LABELS[profile.role] || profile.role },
            { icon: 'fa-envelope', label: 'البريد الإلكتروني', value: profile.email },
            { icon: 'fa-building', label: 'المكتب', value: officeName },
            { icon: 'fa-calendar-plus', label: 'تاريخ الانضمام', value: Utils.formatDate(profile.created_at) },
            { icon: 'fa-right-to-bracket', label: 'آخر تسجيل دخول', value: profile.last_login ? Utils.formatDateTime(profile.last_login) : 'لا يوجد تسجيل دخول سابق' }
        ];

        // كل قيمة قادمة من قاعدة البيانات تمر عبر escapeHTML قبل الإدراج في innerHTML
        const rowsHtml = rows.map(row => `
            <div class="info-row">
                <span class="info-label"><i class="fas ${row.icon}"></i> ${Utils.escapeHTML(row.label)}</span>
                <span class="info-value">${Utils.escapeHTML(row.value)}</span>
            </div>
        `).join('');

        const statusHtml = `
            <div class="info-row">
                <span class="info-label"><i class="fas fa-shield-halved"></i> حالة الحساب</span>
                <span class="info-value">
                    <span class="status-pill ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${Utils.escapeHTML(statusLabel)}
                    </span>
                </span>
            </div>
        `;

        document.getElementById('accountInfoList').innerHTML = rowsHtml + statusHtml;
    }

    /**
     * اسم المكتب غير موجود ضمن استجابة GET /api/users/me، فيُجلب من إعدادات المكتب.
     * المسار متاح لكل الأدوار (requireAuth فقط)، ويُقرأ أولاً من ذاكرة الجلسة التي
     * يملؤها Utils.loadBranding تفاديًا لطلب شبكة مكرر.
     */
    static async fetchOfficeName() {
        try {
            const cached = Utils.getSessionState('settings');
            if (cached && cached.firm_name) return cached.firm_name;

            const result = await API.get('/offices/settings');
            if (result && result.success && result.data && result.data.name) return result.data.name;
        } catch (error) {
            console.error('Failed to load office name:', error);
        }
        return 'غير محدد';
    }

    static async saveProfile() {
        const role = this.currentProfile ? this.currentProfile.role : null;
        const showProfessional = role === 'lawyer' || role === 'trainee';

        const payload = {};
        this.EDITABLE_FIELDS.forEach(field => {
            // الحقول المهنية المخفية لا تُرسل أصلاً حتى لا يمسح دور غير مهني قيمها
            if (!showProfessional && this.PROFESSIONAL_FIELDS.includes(field)) return;

            const input = document.getElementById(field);
            if (!input) return;

            const value = input.value.trim();
            if (field === 'experience_years') {
                // بخلاف phone، سنوات الخبرة بيانات اختيارية ويمكن تفريغها فعليًا،
                // فحقل فارغ هنا يعني "امسح القيمة" ويُرسَل null صراحةً لا أن يُحذف
                // الحقل من الحمولة (حذفه كان يجعل القيمة القديمة تبقى محفوظة بصمت)
                payload[field] = value === '' ? null : parseInt(value, 10);
                return;
            }

            // رقم الهاتف لا يمكن تفريغه ذاتيًا (الخادم يرفض قيمة فارغة بـ400)، فحقل
            // فارغ هنا يعني "بلا تغيير" فلا يُرسَل، تمامًا كحقل سنوات الخبرة الفارغ
            if (field === 'phone' && value === '') return;

            payload[field] = value;
        });

        if (!payload.full_name) {
            Utils.showMessage('الاسم الكامل مطلوب', 'error');
            return;
        }

        try {
            const result = await API.put('/users/me', payload);
            if (result && result.success) {
                Utils.showMessage('تم حفظ بياناتك بنجاح', 'success');
                await this.loadProfile();
            }
        } catch (error) {
            // API.request يعرض رسالة الخادم (مثل رفض حقل غير مسموح) للمستخدم
            console.error('Failed to save profile:', error);
        }
    }

    static async changePassword() {
        const current_password = document.getElementById('current_password').value;
        const new_password = document.getElementById('new_password').value;
        const confirm_password = document.getElementById('confirm_password').value;

        if (new_password !== confirm_password) {
            Utils.showMessage('كلمة المرور الجديدة وتأكيدها غير متطابقين', 'error');
            return;
        }

        try {
            const result = await API.put('/auth/password', { current_password, new_password, confirm_password });
            if (result && result.success) {
                Utils.showMessage('تم تغيير كلمة المرور بنجاح', 'success');
                document.getElementById('passwordForm').reset();

                if (this.forcedPasswordChange) {
                    await this.exitForcedPasswordMode();
                }
            }
        } catch (error) {
            // API.request يعرض رسالة الخادم (مثل رفض كلمة المرور الحالية) للمستخدم
            console.error('Failed to change password:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => ProfileManager.init());
