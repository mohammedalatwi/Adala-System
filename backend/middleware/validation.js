const { body, checkExact, validationResult } = require('express-validator');

/**
 * Common middleware to check for validation errors
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ Validation Errors:', errors.array());
        return res.status(400).json({
            success: false,
            message: 'خطأ في التحقق من البيانات',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

class ValidationMiddleware {
    // Auth Validation
    static get validateRegister() {
        return [
            body('full_name').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
            body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب'),
            body('email').trim().isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
            body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
            body('role').optional().isIn(['admin', 'lawyer', 'client']).withMessage('دور غير صالح'),
            validate
        ];
    }

    // مسار موحّد لإضافة عضو فريق (محامي/متدرب/عميل بوابة) عبر POST /api/team/members —
    // مستقل عن validateRegister لأن الدلالة مختلفة: role إلزامي هنا، وclient_id مطلوب
    // شرطيًا فقط لدور 'client' (لا معنى له بمسار /register الذاتي).
    static get validateCreateTeamMember() {
        return [
            body('full_name').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
            body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب'),
            body('email').trim().isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
            body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
            body('role').notEmpty().isIn(['lawyer', 'trainee', 'client']).withMessage('دور غير صالح'),
            body('client_id')
                .if(body('role').equals('client'))
                .notEmpty().withMessage('يجب اختيار عميل موجود عند إنشاء حساب بوابة'),
            validate
        ];
    }

    static get validateChangePassword() {
        return [
            body('current_password').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
            body('new_password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
            body('confirm_password')
                .notEmpty().withMessage('تأكيد كلمة المرور مطلوب')
                .custom((value, { req }) => value === req.body.new_password)
                .withMessage('كلمة المرور الجديدة وتأكيدها غير متطابقين'),
            validate
        ];
    }

    static get validateLogin() {
        return [
            body('email').trim().notEmpty().withMessage('يرجى إدخال البريد الإلكتروني أو اسم المستخدم'),
            body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
            validate
        ];
    }

    // Case Validation
    static get validateCase() {
        return [
            body('case_number').trim().notEmpty().withMessage('رقم القضية مطلوب'),
            body('title').trim().notEmpty().withMessage('عنوان القضية مطلوب'),
            body('client_id').notEmpty().withMessage('يجب اختيار موكل صالح'),
            body('lawyer_id').notEmpty().withMessage('يجب اختيار المحامي المسؤول عن القضية'),
            body('case_type').trim().notEmpty().withMessage('يجب اختيار نوع القضية')
                .isIn(['مدني', 'جنائي', 'تجاري', 'أسرة', 'عمل', 'إداري']).withMessage('نوع القضية غير صالح'),
            validate
        ];
    }

    // Client Validation
    static get validateClient() {
        return [
            body('full_name').trim().notEmpty().withMessage('اسم الموكل مطلوب'),
            body('phone').trim().notEmpty().withMessage('رقم الهاتف مطلوب'),
            body('email').optional().custom((value) => {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    throw new Error('يرجى إدخال بريد إلكتروني صحيح');
                }
                return true;
            }),
            validate
        ];
    }

    // Session Validation
    static get validateSession() {
        return [
            body('case_id').notEmpty().withMessage('يجب اختيار قضية صالحة'),
            body('session_date').notEmpty().withMessage('تاريخ الجلسة مطلوب'),
            body('session_type').trim().notEmpty().withMessage('نوع الجلسة مطلوب'),
            validate
        ];
    }

    // Task Validation
    static get validateTask() {
        return [
            body('title').trim().notEmpty().withMessage('عنوان المهمة مطلوب'),
            body('assigned_to').optional({ checkFalsy: true }),
            body('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('تاريخ الاستحقاق غير صالح'),
            validate
        ];
    }

    // Invoice Validation
    static get validateInvoice() {
        return [
            body('client_id').notEmpty().withMessage('يجب اختيار عميل صالح'),
            body('issue_date').notEmpty().withMessage('تاريخ الإصدار مطلوب'),
            body('items').isArray({ min: 1 }).withMessage('يجب إضافة بند واحد على الأقل للفاتورة'),
            body('items.*.description').trim().notEmpty().withMessage('وصف بند الفاتورة مطلوب'),
            body('items.*.quantity').isFloat({ gt: 0 }).withMessage('كمية البند يجب أن تكون رقماً أكبر من صفر'),
            body('items.*.unit_price').isFloat({ min: 0 }).withMessage('سعر الوحدة يجب أن يكون رقماً صالحاً'),
            validate
        ];
    }

    // Expense Validation
    static get validateExpense() {
        return [
            body('title').trim().notEmpty().withMessage('عنوان المصروف مطلوب'),
            body('amount').notEmpty().withMessage('قيمة المصروف مطلوبة')
                .isFloat({ gt: 0 }).withMessage('قيمة المصروف يجب أن تكون رقماً أكبر من صفر'),
            body('expense_date').notEmpty().withMessage('تاريخ المصروف مطلوب'),
            validate
        ];
    }

    // Case Update Validation (partial — mirrors CaseService.updateCase's allowlist)
    static get validateCaseUpdate() {
        return [
            body('case_number').optional().trim().notEmpty().withMessage('رقم القضية لا يمكن أن يكون فارغاً'),
            body('title').optional().trim().notEmpty().withMessage('عنوان القضية لا يمكن أن يكون فارغاً'),
            body('client_id').optional().notEmpty().withMessage('معرّف الموكل غير صالح'),
            body('lawyer_id').optional().notEmpty().withMessage('معرّف المحامي غير صالح'),
            body('case_type').optional().trim().notEmpty()
                .isIn(['مدني', 'جنائي', 'تجاري', 'أسرة', 'عمل', 'إداري']).withMessage('نوع القضية غير صالح'),
            validate
        ];
    }

    // Client Update Validation (partial — mirrors ClientService.updateClient's allowlist)
    static get validateClientUpdate() {
        return [
            body('full_name').optional().trim().notEmpty().withMessage('اسم الموكل لا يمكن أن يكون فارغاً'),
            body('phone').optional().trim().notEmpty().withMessage('رقم الهاتف لا يمكن أن يكون فارغاً'),
            body('email').optional().custom((value) => {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    throw new Error('يرجى إدخال بريد إلكتروني صحيح');
                }
                return true;
            }),
            validate
        ];
    }

    // Session Update Validation (partial — mirrors SessionService.updateSession's allowlist)
    static get validateSessionUpdate() {
        return [
            body('session_date').optional().notEmpty().withMessage('تاريخ الجلسة لا يمكن أن يكون فارغاً'),
            body('session_type').optional().trim().notEmpty().withMessage('نوع الجلسة لا يمكن أن يكون فارغاً'),
            validate
        ];
    }

    // Task Update Validation (partial — mirrors TaskService.updateTask's allowlist)
    static get validateTaskUpdate() {
        return [
            body('title').optional().trim().notEmpty().withMessage('عنوان المهمة لا يمكن أن يكون فارغاً'),
            body('assigned_to').optional({ checkFalsy: true }),
            body('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('تاريخ الاستحقاق غير صالح'),
            validate
        ];
    }

    // Document Update Validation (partial — mirrors DocumentService.updateDocument's allowlist)
    static get validateDocumentUpdate() {
        return [
            body('title').optional().trim().notEmpty().withMessage('عنوان المستند لا يمكن أن يكون فارغاً'),
            body('is_confidential').optional().isBoolean().withMessage('قيمة السرية غير صالحة'),
            validate
        ];
    }

    // User Update Validation (partial — mirrors UserService.updateUser's allowlist; note password is not part of that allowlist)
    static get validateUserUpdate() {
        return [
            body('full_name').optional().trim().notEmpty().withMessage('الاسم الكامل لا يمكن أن يكون فارغاً'),
            body('username').optional().trim().notEmpty().withMessage('اسم المستخدم لا يمكن أن يكون فارغاً'),
            body('email').optional().trim().isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
            validate
        ];
    }

    // User Status Update Validation
    static get validateUserStatusUpdate() {
        return [
            body('is_active').notEmpty().withMessage('حالة التفعيل مطلوبة')
                .isBoolean().withMessage('قيمة حالة التفعيل غير صالحة'),
            validate
        ];
    }

    // Office Settings Update Validation (partial — mirrors OfficeService.updateOfficeSettings's allowlist)
    static get validateOfficeSettings() {
        return [
            body('name').optional().trim().notEmpty().withMessage('اسم المكتب لا يمكن أن يكون فارغاً'),
            body('email').optional().custom((value) => {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    throw new Error('يرجى إدخال بريد إلكتروني صحيح');
                }
                return true;
            }),
            body('settings').optional().isObject().withMessage('صيغة الإعدادات غير صالحة'),
            validate
        ];
    }

    // Payment Validation
    static get validatePayment() {
        return [
            body('invoice_id').notEmpty().withMessage('يجب اختيار فاتورة صالحة'),
            body('amount').notEmpty().withMessage('قيمة الدفعة مطلوبة')
                .isFloat({ gt: 0 }).withMessage('قيمة الدفعة يجب أن تكون رقماً أكبر من صفر')
                .toFloat(),
            body('payment_date').notEmpty().withMessage('تاريخ الدفعة مطلوب'),
            body('payment_method').trim().notEmpty().withMessage('طريقة الدفع مطلوبة'),
            validate
        ];
    }

    // Office Branding Settings Update Validation (partial — allowlist based on
    // SettingsService.getSettings' known keys; SettingsService.updateSettings itself
    // merges req.body into settings_json with no key restriction, so this is enforced here)
    static get validateSettingsUpdate() {
        const chains = [
            body('firm_name').optional().trim().notEmpty().withMessage('اسم المكتب لا يمكن أن يكون فارغاً'),
            body('firm_logo').optional({ nullable: true }).isString().withMessage('صيغة الشعار غير صالحة'),
            body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('صيغة اللون غير صالحة (مثال: #2563eb)'),
        ];
        return [
            ...chains,
            checkExact(chains, { message: 'حقل غير مسموح به في هذا الطلب' }),
            validate
        ];
    }

    // Helper for required fields
    static validateRequiredFields(fields) {
        return [
            ...fields.map(field => body(field).notEmpty().withMessage(`حقل ${field} مطلوب`)),
            validate
        ];
    }
}

module.exports = ValidationMiddleware;