const SettingsService = require('../services/SettingsService');
const BaseController = require('../utils/BaseController');

class SettingsController extends BaseController {
    // ✅ الحصول على جميع الإعدادات
    getSettings = this.asyncWrapper(async (req, res) => {
        const settings = await SettingsService.getSettings();
        this.sendSuccess(res, settings);
    });

    // ✅ تحديث الإعدادات
    updateSettings = this.asyncWrapper(async (req, res) => {
        const allowedRoles = ['admin', 'lawyer'];
        if (!allowedRoles.includes(req.session.userRole)) {
            return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل الإعدادات' });
        }

        await SettingsService.updateSettings(req.body);
        this.sendSuccess(res, null, 'تم تحديث الإعدادات بنجاح');
    });

    // ✅ رفع شعار المكتب
    uploadLogo = this.asyncWrapper(async (req, res) => {
        const allowedRoles = ['admin', 'lawyer'];
        if (!allowedRoles.includes(req.session.userRole)) {
            return res.status(403).json({ success: false, message: 'غير مصرح لك برفع الشعار' });
        }

        if (!req.file) throw new Error('لم يتم اختيار ملف');

        const logoPath = `/uploads/branding/${req.file.filename}`;
        await SettingsService.updateFirmLogo(logoPath);

        this.sendSuccess(res, { logoPath }, 'تم رفع الشعار بنجاح');
    });

    // ✅ الحصول على إعدادات التنبيهات للمستخدم الحالي
    getNotificationSettings = this.asyncWrapper(async (req, res) => {
        const settings = await SettingsService.getNotificationSettings(req.session.userId);
        this.sendSuccess(res, settings);
    });

    // ✅ تحديث إعدادات التنبيهات للمستخدم الحالي
    updateNotificationSettings = this.asyncWrapper(async (req, res) => {
        await SettingsService.updateNotificationSettings(req.session.userId, req.body);
        this.sendSuccess(res, null, 'تم حفظ إعدادات التنبيهات بنجاح');
    });
}

module.exports = new SettingsController();
