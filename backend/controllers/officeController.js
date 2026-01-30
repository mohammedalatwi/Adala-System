const db = require('../db/database');
const AuthMiddleware = require('../middleware/auth');

class OfficeController {
    // ✅ الحصول على إعدادات المكتب الحالي
    getOfficeSettings = async (req, res) => {
        try {
            const officeId = req.session.officeId;

            if (!officeId) {
                return res.status(401).json({
                    success: false,
                    message: 'يجب أن تنتمي إلى مكتب للوصول إلى هذه الإعدادات'
                });
            }

            const office = await db.get(
                'SELECT * FROM offices WHERE id = ?',
                [officeId]
            );

            if (!office) {
                return res.status(404).json({
                    success: false,
                    message: 'لم يتم العثور على بيانات المكتب'
                });
            }

            // فك تشفير الإعدادات إذا كانت مخزنة كـ JSON نصي
            if (office.settings_json && typeof office.settings_json === 'string') {
                try {
                    office.settings = JSON.parse(office.settings_json);
                } catch (e) {
                    office.settings = {};
                }
            } else {
                office.settings = office.settings_json || {};
            }

            res.json({
                success: true,
                data: office
            });

        } catch (error) {
            console.error('Get office settings error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إعدادات المكتب'
            });
        }
    };

    // ✅ تحديث إعدادات المكتب
    updateOfficeSettings = async (req, res) => {
        try {
            const officeId = req.session.officeId;
            const userRole = req.session.userRole;

            if (userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'فقط مدير المكتب يمكنه تعديل الإعدادات'
                });
            }

            const {
                name,
                address,
                phone,
                email,
                settings
            } = req.body;

            const settingsJson = settings ? JSON.stringify(settings) : '{}';

            await db.run(
                `UPDATE offices 
                 SET name = ?, address = ?, phone = ?, email = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [name, address, phone, email, settingsJson, officeId]
            );

            // تسجيل النشاط
            await AuthMiddleware.logActivity(
                req.session.userId,
                'تحديث إعدادات المكتب والبيانات الأساسية',
                'update',
                'office',
                officeId,
                req.ip,
                req.get('User-Agent'),
                officeId
            );

            res.json({
                success: true,
                message: 'تم تحديث إعدادات المكتب بنجاح'
            });

        } catch (error) {
            console.error('Update office settings error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث إعدادات المكتب'
            });
        }
    };

    // ✅ رفع شعار المكتب
    uploadLogo = async (req, res) => {
        try {
            const officeId = req.session.officeId;
            const userRole = req.session.userRole;

            if (userRole !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'فقط مدير المكتب يمكنه تغيير الشعار'
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'يرجى اختيار ملف الشعار'
                });
            }

            const logoUrl = `/uploads/${req.file.filename}`;

            await db.run(
                'UPDATE offices SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [logoUrl, officeId]
            );

            res.json({
                success: true,
                message: 'تم رفع الشعار بنجاح',
                logo_url: logoUrl
            });

        } catch (error) {
            console.error('Upload office logo error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء رفع الشعار'
            });
        }
    };
}

module.exports = new OfficeController();
