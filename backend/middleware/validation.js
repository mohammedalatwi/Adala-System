/**
 * validation.js - نظام التحقق من صحة البيانات
 */

class ValidationMiddleware {

    // ✅ التحقق من صحة البريد الإلكتروني
    static validateEmail(email) {
        try {
            if (!email || typeof email !== 'string') {
                return false;
            }

            const cleanEmail = email.trim().toLowerCase();

            // regex شامل للبريد الإلكتروني
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const isValid = emailRegex.test(cleanEmail);

            console.log(`📧 التحقق من البريد: ${cleanEmail} -> ${isValid ? 'صالح' : 'غير صالح'}`);
            return isValid;

        } catch (error) {
            console.error('❌ خطأ في التحقق من البريد:', error);
            return false;
        }
    }

    // ✅ التحقق من تسجيل مستخدم جديد
    static validateRegister(req, res, next) {
        try {
            const { full_name, username, email, password, phone } = req.body;
            const errors = [];

            console.log('🔍 التحقق من بيانات التسجيل:', {
                full_name: full_name?.substring(0, 20) + '...',
                username,
                email
            });

            // التحقق من الاسم الكامل
            if (!full_name || full_name.trim().length < 2) {
                errors.push('الاسم الكامل يجب أن يكون على الأقل حرفين');
            } else if (full_name.trim().length > 100) {
                errors.push('الاسم الكامل يجب أن لا يتجاوز 100 حرف');
            }

            // التحقق من اسم المستخدم
            if (!username || username.trim().length < 3) {
                errors.push('اسم المستخدم يجب أن يكون على الأقل 3 أحرف');
            } else if (username.trim().length > 50) {
                errors.push('اسم المستخدم يجب أن لا يتجاوز 50 حرف');
            } else if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username)) {
                errors.push('اسم المستخدم يمكن أن يحتوي على أحرف عربية، إنجليزية، أرقام و _ فقط');
            }

            // التحقق من البريد الإلكتروني
            if (!email) {
                errors.push('البريد الإلكتروني مطلوب');
            } else if (!ValidationMiddleware.validateEmail(email)) {
                errors.push('البريد الإلكتروني غير صالح');
            } else if (email.length > 100) {
                errors.push('البريد الإلكتروني يجب أن لا يتجاوز 100 حرف');
            }

            // التحقق من كلمة المرور
            if (!password) {
                errors.push('كلمة المرور مطلوبة');
            } else if (password.length < 6) {
                errors.push('كلمة المرور يجب أن تكون على الأقل 6 أحرف');
            } else if (password.length > 100) {
                errors.push('كلمة المرور يجب أن لا تتجاوز 100 حرف');
            }

            // التحقق من رقم الهاتف (اختياري)
            if (phone && phone.trim() !== '') {
                const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
                if (!phoneRegex.test(phone.trim())) {
                    errors.push('رقم الهاتف غير صالح');
                }
            }

            if (errors.length > 0) {
                console.log('❌ أخطاء التحقق:', errors);
                return res.status(400).json({
                    success: false,
                    message: errors.join('، ')
                });
            }

            console.log('✅ جميع بيانات التسجيل صالحة');
            next();

        } catch (error) {
            console.error('❌ خطأ في التحقق من التسجيل:', error);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في التحقق من البيانات'
            });
        }
    }

    // ✅ التحقق من تسجيل الدخول
    static validateLogin(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
                });
            }

            if (!ValidationMiddleware.validateEmail(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'البريد الإلكتروني غير صالح'
                });
            }

            next();

        } catch (error) {
            console.error('❌ خطأ في التحقق من الدخول:', error);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في التحقق من البيانات'
            });
        }
    }

    // ✅ تنظيف البيانات
    static sanitizeBody(req, res, next) {
        try {
            if (req.body) {
                Object.keys(req.body).forEach(key => {
                    if (typeof req.body[key] === 'string') {
                        req.body[key] = req.body[key].trim();

                        // منع حقن HTML
                        req.body[key] = req.body[key]
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/'/g, '&#x27;')
                            .replace(/"/g, '&quot;');
                    }
                });
            }
            next();
        } catch (error) {
            console.error('❌ خطأ في تنظيف البيانات:', error);
            next();
        }
    }

    // ✅ التحقق من البيانات العامة
    static validateRequiredFields(requiredFields) {
        return (req, res, next) => {
            try {
                const errors = [];
                const body = req.body || {};

                requiredFields.forEach(field => {
                    if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
                        errors.push(`حقل ${field} مطلوب`);
                    }
                });

                if (errors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: errors.join('، ')
                    });
                }

                next();
            } catch (error) {
                console.error('❌ خطأ في التحقق من الحقول:', error);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ في التحقق من البيانات'
                });
            }
        };
    }

    // ✅ التحقق من صحة رقم الهاتف
    static validatePhone(req, res, next) {
        try {
            const { phone } = req.body;

            if (phone && phone.trim() !== '') {
                const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
                if (!phoneRegex.test(phone.trim())) {
                    return res.status(400).json({
                        success: false,
                        message: 'رقم الهاتف غير صالح'
                    });
                }
            }

            next();
        } catch (error) {
            console.error('❌ خطأ في التحقق من الهاتف:', error);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في التحقق من رقم الهاتف'
            });
        }
    }

    // ✅ التحقق من صحة الرقم الوطني
    static validateNationalId(req, res, next) {
        try {
            const { national_id } = req.body;

            if (national_id && national_id.trim() !== '') {
                const idRegex = /^[0-9]{10}$/;
                if (!idRegex.test(national_id.trim())) {
                    return res.status(400).json({
                        success: false,
                        message: 'الرقم الوطني يجب أن يكون 10 أرقام'
                    });
                }
            }

            next();
        } catch (error) {
            console.error('❌ خطأ في التحقق من الرقم الوطني:', error);
            return res.status(500).json({
                success: false,
                message: 'حدث خطأ في التحقق من الرقم الوطني'
            });
        }
    }

    // ✅ التحقق من صحة التاريخ
    static validateDate(fieldName) {
        return (req, res, next) => {
            try {
                const dateValue = req.body[fieldName];

                if (dateValue && dateValue.trim() !== '') {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) {
                        return res.status(400).json({
                            success: false,
                            message: `حقل ${fieldName} غير صالح`
                        });
                    }

                    // التحقق من أن التاريخ ليس في المستقبل البعيد
                    const maxDate = new Date();
                    maxDate.setFullYear(maxDate.getFullYear() + 10);

                    if (date > maxDate) {
                        return res.status(400).json({
                            success: false,
                            message: `التاريخ لا يمكن أن يكون بعد ${maxDate.getFullYear()}`
                        });
                    }
                }

                next();
            } catch (error) {
                console.error(`❌ خطأ في التحقق من التاريخ ${fieldName}:`, error);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ في التحقق من التاريخ'
                });
            }
        };
    }

    // ✅ التحقق من صحة الملف
    static validateFile(fieldName, allowedTypes = [], maxSizeMB = 5) {
        return (req, res, next) => {
            try {
                if (!req.files || !req.files[fieldName]) {
                    return next();
                }

                const file = req.files[fieldName];

                // التحقق من نوع الملف
                if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        message: `نوع الملف غير مسموح. المسموح: ${allowedTypes.join(', ')}`
                    });
                }

                // التحقق من حجم الملف
                const maxSize = maxSizeMB * 1024 * 1024;
                if (file.size > maxSize) {
                    return res.status(400).json({
                        success: false,
                        message: `حجم الملف يجب أن لا يتجاوز ${maxSizeMB} ميجابايت`
                    });
                }

                next();
            } catch (error) {
                console.error(`❌ خطأ في التحقق من الملف ${fieldName}:`, error);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ في التحقق من الملف'
                });
            }
        };
    }

    // ✅ التحقق من الصلاحيات
    static requireRole(allowedRoles) {
        return (req, res, next) => {
            try {
                if (!req.session || !req.session.userRole) {
                    return res.status(401).json({
                        success: false,
                        message: 'يجب تسجيل الدخول للوصول إلى هذا المورد'
                    });
                }

                if (!allowedRoles.includes(req.session.userRole)) {
                    return res.status(403).json({
                        success: false,
                        message: 'غير مصرح بالوصول إلى هذا المورد'
                    });
                }

                next();
            } catch (error) {
                console.error('❌ خطأ في التحقق من الصلاحيات:', error);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ في التحقق من الصلاحيات'
                });
            }
        };
    }

    // ✅ التحقق من ملكية المورد
    static checkOwnership(modelName, idField = 'id') {
        return async (req, res, next) => {
            try {
                if (!req.session || !req.session.userId) {
                    return res.status(401).json({
                        success: false,
                        message: 'يجب تسجيل الدخول'
                    });
                }

                // المديرين يمكنهم الوصول لكل شيء
                if (req.session.userRole === 'admin') {
                    return next();
                }

                // TODO: تنفيذ التحقق من ملكية المورد حسب النموذج
                // هذا يحتاج إلى تكامل مع قاعدة البيانات

                next();
            } catch (error) {
                console.error('❌ خطأ في التحقق من الملكية:', error);
                return res.status(500).json({
                    success: false,
                    message: 'حدث خطأ في التحقق من الملكية'
                });
            }
        };
    }

    // ✅ منع هجمات XSS
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;

        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#x27;')
            .replace(/"/g, '&quot;')
            .replace(/\//g, '&#x2F;')
            .replace(/\\/g, '&#x5C;')
            .replace(/`/g, '&#x60;');
    }

    // ✅ التحقق من صحة الـ URL
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    }

    // ✅ التحقق من صحة بيانات القضية
    static validateCase(req, res, next) {
        try {
            const { title, case_type, client_id, lawyer_id, case_number } = req.body;
            const errors = [];

            if (!title || title.trim().length < 3) errors.push('عنوان القضية مطلوب (3 أحرف على الأقل)');
            if (!case_type) errors.push('نوع القضية مطلوب');
            if (!client_id) errors.push('العميل مطلوب');
            if (!lawyer_id) errors.push('المحامي مطلوب');
            if (case_number && case_number.trim().length < 3) errors.push('رقم القضية يجب أن يكون 3 أحرف على الأقل');

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: errors.join('، ')
                });
            }

            next();
        } catch (error) {
            console.error('Validate case error:', error);
            res.status(500).json({ success: false, message: 'خطأ في التحقق من القضية' });
        }
    }

    // ✅ التحقق من صحة بيانات الجلسة
    static validateSession(req, res, next) {
        try {
            const { case_id, session_date, session_number } = req.body;
            const errors = [];

            if (!case_id) errors.push('رقم القضية مطلوب');
            if (!session_date) errors.push('تاريخ الجلسة مطلوب');
            // session_number might be auto-generated

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: errors.join('، ')
                });
            }

            next();
        } catch (error) {
            console.error('Validate session error:', error);
            res.status(500).json({ success: false, message: 'خطأ في التحقق من الجلسة' });
        }
    }
}

module.exports = ValidationMiddleware;