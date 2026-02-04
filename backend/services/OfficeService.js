const db = require('../db/database');
const ActivityService = require('./ActivityService');

class OfficeService {
    constructor() {
        this.db = db;
    }

    async getOfficeSettings(officeId) {
        if (!officeId) throw new Error('يجب أن تنتمي إلى مكتب للوصول إلى هذه الإعدادات');

        const office = await this.db.get('SELECT * FROM offices WHERE id = ?', [officeId]);
        if (!office) throw new Error('لم يتم العثور على بيانات المكتب');

        // فك تشفير الإعدادات
        if (office.settings_json && typeof office.settings_json === 'string') {
            try {
                office.settings = JSON.parse(office.settings_json);
            } catch (e) {
                office.settings = {};
            }
        } else {
            office.settings = office.settings_json || {};
        }

        return office;
    }

    async updateOfficeSettings(officeId, updateData, userId) {
        const { name, address, phone, email, settings } = updateData;
        const settingsJson = settings ? JSON.stringify(settings) : '{}';

        await this.db.run(
            `UPDATE offices 
             SET name = ?, address = ?, phone = ?, email = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, address, phone, email, settingsJson, officeId]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'office',
            entityId: officeId,
            description: 'تحديث إعدادات المكتب والبيانات الأساسية',
            officeId
        });

        return true;
    }

    async updateLogo(officeId, logoUrl, userId) {
        await this.db.run(
            'UPDATE offices SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [logoUrl, officeId]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'office',
            entityId: officeId,
            description: 'تحديث شعار المكتب',
            officeId
        });

        return logoUrl;
    }
}

module.exports = new OfficeService();
