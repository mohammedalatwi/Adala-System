const { body, validationResult } = require('express-validator');

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

    // Helper for required fields
    static validateRequiredFields(fields) {
        return [
            ...fields.map(field => body(field).notEmpty().withMessage(`حقل ${field} مطلوب`)),
            validate
        ];
    }
}

module.exports = ValidationMiddleware;