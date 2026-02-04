const OfficeService = require('../services/OfficeService');
const BaseController = require('../utils/BaseController');

class OfficeController extends BaseController {
    // ✅ الحصول على إعدادات المكتب الحالي
    getOfficeSettings = this.asyncWrapper(async (req, res) => {
        const office = await OfficeService.getOfficeSettings(req.session.officeId);
        this.sendSuccess(res, office);
    });

    // ✅ تحديث إعدادات المكتب
    updateOfficeSettings = this.asyncWrapper(async (req, res) => {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'فقط مدير المكتب يمكنه تعديل الإعدادات' });
        }

        await OfficeService.updateOfficeSettings(req.session.officeId, req.body, req.session.userId);
        this.sendSuccess(res, null, 'تم تحديث إعدادات المكتب بنجاح');
    });

    // ✅ رفع شعار المكتب
    uploadLogo = this.asyncWrapper(async (req, res) => {
        if (req.session.userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'فقط مدير المكتب يمكنه تغيير الشعار' });
        }

        if (!req.file) throw new Error('يرجى اختيار ملف الشعار');

        const logoUrl = `/uploads/${req.file.filename}`;
        await OfficeService.updateLogo(req.session.officeId, logoUrl, req.session.userId);

        this.sendSuccess(res, { logo_url: logoUrl }, 'تم رفع الشعار بنجاح');
    });
}

module.exports = new OfficeController();
