class ValidationMiddleware {
    // ✅ التحقق من بيانات تسجيل المستخدم
    validateRegister = (req, res, next) => {
        const { full_name, username, email, password } = req.body;
        const errors = [];

        if (!full_name || full_name.trim().length < 2) {
            errors.push('الاسم الكامل يجب أن يكون على الأقل حرفين');
        }

        if (!username || username.trim().length < 3) {
            errors.push('اسم المستخدم يجب أن يكون على الأقل 3 أحرف');
        }

        if (!email || !this.isValidEmail(email)) {
            errors.push('البريد الإلكتروني غير صالح');
        }

        if (!password || password.length < 6) {
            errors.push('كلمة المرور يجب أن تكون على الأقل 6 أحرف');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'بيانات غير صالحة',
                errors
            });
        }

        next();
    };

    // ✅ التحقق من بيانات تسجيل الدخول
    validateLogin = (req, res, next) => {
        const { email, password } = req.body;
        const errors = [];

        if (!email || !this.isValidEmail(email)) {
            errors.push('البريد الإلكتروني غير صالح');
        }

        if (!password) {
            errors.push('كلمة المرور مطلوبة');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'بيانات غير صالحة',
                errors
            });
        }

        next();
    };

    // ✅ التحقق من بيانات القضية
    validateCase = (req, res, next) => {
        const { case_number, title, case_type, client_id, lawyer_id } = req.body;
        const errors = [];

        if (!case_number || case_number.trim().length === 0) {
            errors.push('رقم القضية مطلوب');
        }

        if (!title || title.trim().length < 5) {
            errors.push('عنوان القضية يجب أن يكون على الأقل 5 أحرف');
        }

        if (!case_type || !['مدني', 'جنائي', 'تجاري', 'أسرة', 'عمل', 'إداري'].includes(case_type)) {
            errors.push('نوع القضية غير صالح');
        }

        if (!client_id || isNaN(client_id)) {
            errors.push('معرف العميل غير صالح');
        }

        if (!lawyer_id || isNaN(lawyer_id)) {
            errors.push('معرف المحامي غير صالح');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'بيانات القضية غير صالحة',
                errors
            });
        }

        next();
    };

    // ✅ التحقق من بيانات الجلسة
    validateSession = (req, res, next) => {
        const { case_id, session_date, session_type } = req.body;
        const errors = [];

        if (!case_id || isNaN(case_id)) {
            errors.push('معرف القضية غير صالح');
        }

        if (!session_date || isNaN(new Date(session_date))) {
            errors.push('تاريخ الجلسة غير صالح');
        }

        if (!session_type || !['استماع', 'نظر', 'تحكيم', 'إثبات', 'حكم'].includes(session_type)) {
            errors.push('نوع الجلسة غير صالح');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'بيانات الجلسة غير صالحة',
                errors
            });
        }

        next();
    };

    // ✅ التحقق من صحة البريد الإلكتروني
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ✅ التحقق من صحة رقم الهاتف السعودي
    isValidSaudiPhone(phone) {
        const phoneRegex = /^(05)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
        return phoneRegex.test(phone);
    }

    // ✅ التحقق من صحة الرقم الوطني السعودي
    isValidSaudiNationalId(id) {
        const idRegex = /^[0-9]{10}$/;
        return idRegex.test(id);
    }

    // ✅ تنظيف البيانات من الأحرف الضارة
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')
            .replace(/"/g, '&#34;');
    }

    // ✅ وسيط تنظيف البيانات
    sanitizeBody = (req, res, next) => {
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                if (typeof req.body[key] === 'string') {
                    req.body[key] = this.sanitizeInput(req.body[key]);
                }
            });
        }
        next();
    };
}

module.exports = new ValidationMiddleware();