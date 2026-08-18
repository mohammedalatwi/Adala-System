const db = require('../db/database');

class SettingsService {
    constructor() {
        this.db = db;
    }

    async getSettings(officeId) {
        const office = await this.db.get('SELECT settings_json FROM offices WHERE id = ?', [officeId]);
        if (!office) throw new Error('لم يتم العثور على بيانات المكتب');

        let settings = {};
        if (office.settings_json && typeof office.settings_json === 'string') {
            try {
                settings = JSON.parse(office.settings_json);
            } catch (e) {
                settings = {};
            }
        }

        return {
            firm_name: 'نظام عدالة',
            firm_logo: null,
            primary_color: '#2563eb',
            ...settings
        };
    }

    async updateSettings(officeId, updates) {
        const current = await this.getSettings(officeId);
        const merged = { ...current, ...updates };

        await this.db.run(
            'UPDATE offices SET settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(merged), officeId]
        );

        return true;
    }

    async getNotificationSettings(userId) {
        const settings = await this.db.get('SELECT * FROM notification_settings WHERE user_id = ?', [userId]);
        if (!settings) {
            return {
                reminder_intervals: '["7d", "3d", "24h", "2h"]',
                email_enabled: 1,
                whatsapp_enabled: 0,
                sms_enabled: 0
            };
        }
        return settings;
    }

    async updateNotificationSettings(userId, settingsData) {
        const { reminder_intervals, email_enabled } = settingsData;
        await this.db.run(
            `INSERT INTO notification_settings (user_id, reminder_intervals, email_enabled, updated_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP) 
             ON CONFLICT(user_id) DO UPDATE SET 
                reminder_intervals = excluded.reminder_intervals,
                email_enabled = excluded.email_enabled,
                updated_at = CURRENT_TIMESTAMP`,
            [userId, JSON.stringify(reminder_intervals || []), email_enabled ? 1 : 0]
        );
        return true;
    }

    async updateFirmLogo(officeId, logoPath) {
        await this.updateSettings(officeId, { firm_logo: logoPath });
        return logoPath;
    }
}

module.exports = new SettingsService();
