const db = require('../db/database');

class SettingsService {
    constructor() {
        this.db = db;
    }

    async getSettings() {
        const rows = await this.db.all('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    }

    async updateSettings(updates) {
        await this.db.run('BEGIN TRANSACTION');
        try {
            for (const [key, value] of Object.entries(updates)) {
                await this.db.run(
                    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
                    [key, value]
                );
            }
            await this.db.run('COMMIT');
            return true;
        } catch (error) {
            await this.db.run('ROLLBACK');
            throw error;
        }
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

    async updateFirmLogo(logoPath) {
        await this.db.run(
            'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
            ['firm_logo', logoPath]
        );
        return logoPath;
    }
}

module.exports = new SettingsService();
