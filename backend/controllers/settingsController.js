const db = require('../db/database');
const path = require('path');
const fs = require('fs');

class SettingsController {
    /**
     * الحصول على جميع الإعدادات
     */
    async getSettings(req, res) {
        try {
            const rows = await db.all('SELECT key, value FROM settings');
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = row.value;
            });
            res.json({ success: true, settings });
        } catch (error) {
            console.error('Error fetching settings:', error);
            res.status(500).json({ success: false, message: 'فشل في تحميل الإعدادات' });
        }
    }

    /**
     * تحديث الإعدادات
     */
    async updateSettings(req, res) {
        // التحقق من الصلاحيات (للمسؤول والمحامي)
        const allowedRoles = ['admin', 'lawyer'];
        if (!allowedRoles.includes(req.session.userRole)) {
            return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل الإعدادات' });
        }

        const updates = req.body;

        try {
            await db.beginTransaction();

            for (const [key, value] of Object.entries(updates)) {
                await db.run(
                    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
                    [key, value]
                );
            }

            await db.commit();
            res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح' });
        } catch (error) {
            await db.rollback();
            console.error('Error updating settings:', error);
            res.status(500).json({ success: false, message: 'فشل في تحديث الإعدادات' });
        }
    }

    /**
     * رفع شعار المكتب
     */
    async uploadLogo(req, res) {
        const allowedRoles = ['admin', 'lawyer'];
        if (!allowedRoles.includes(req.session.userRole)) {
            return res.status(403).json({ success: false, message: 'غير مصرح لك برفع الشعار' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'لم يتم اختيار ملف' });
        }

        try {
            const logoPath = `/uploads/branding/${req.file.filename}`;

            await db.run(
                'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
                ['firm_logo', logoPath]
            );

            res.json({
                success: true,
                message: 'تم رفع الشعار بنجاح',
                logoPath
            });
        } catch (error) {
            console.error('Error uploading logo:', error);
            res.status(500).json({ success: false, message: 'فشل في حفظ الشعار' });
        }
    }

    /**
     * الحصول على إعدادات التنبيهات للمستخدم الحالي
     */
    async getNotificationSettings(req, res) {
        try {
            const userId = req.session.userId;
            const settings = await db.get('SELECT * FROM notification_settings WHERE user_id = ?', [userId]);

            // إذا لم توجد إعدادات، نرجع الافتراضي
            if (!settings) {
                return res.json({
                    success: true,
                    settings: {
                        reminder_intervals: '["7d", "3d", "24h", "2h"]',
                        email_enabled: 1,
                        whatsapp_enabled: 0,
                        sms_enabled: 0
                    }
                });
            }

            res.json({ success: true, settings });
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            res.status(500).json({ success: false, message: 'فشل في تحميل إعدادات التنبيهات' });
        }
    }

    /**
     * تحديث إعدادات التنبيهات للمستخدم الحالي
     */
    async updateNotificationSettings(req, res) {
        try {
            const userId = req.session.userId;
            const { reminder_intervals, email_enabled } = req.body;

            await db.run(
                `INSERT INTO notification_settings (user_id, reminder_intervals, email_enabled, updated_at) 
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
                 ON CONFLICT(user_id) DO UPDATE SET 
                    reminder_intervals = excluded.reminder_intervals,
                    email_enabled = excluded.email_enabled,
                    updated_at = CURRENT_TIMESTAMP`,
                [userId, JSON.stringify(reminder_intervals || []), email_enabled ? 1 : 0]
            );

            res.json({ success: true, message: 'تم حفظ إعدادات التنبيهات بنجاح' });
        } catch (error) {
            console.error('Error updating notification settings:', error);
            res.status(500).json({ success: false, message: 'فشل في حفظ إعدادات التنبيهات' });
        }
    }
}

module.exports = new SettingsController();
