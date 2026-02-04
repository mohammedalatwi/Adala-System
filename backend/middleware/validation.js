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
            body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
            body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
            body('role').optional().isIn(['admin', 'lawyer', 'client']).withMessage('دور غير صالح'),
            validate
        ];
    }

    static get validateLogin() {
        return [
            body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
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
            body('assigned_to').notEmpty().withMessage('يجب تعيين المهمة لشخص ما'),
            body('due_date').optional().isISO8601().withMessage('تاريخ الاستحقاق غير صالح'),
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