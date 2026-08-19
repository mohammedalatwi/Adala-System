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
        const existingOffice = await this.db.get('SELECT settings_json FROM offices WHERE id = ?', [officeId]);
        if (!existingOffice) throw new Error('لم يتم العثور على بيانات المكتب');

        const allowedFields = ['name', 'address', 'phone', 'email'];
        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updateData.settings !== undefined) {
            let currentSettings = {};
            if (existingOffice.settings_json && typeof existingOffice.settings_json === 'string') {
                try {
                    currentSettings = JSON.parse(existingOffice.settings_json);
                } catch (e) {
                    currentSettings = {};
                }
            }
            updates.push('settings_json = ?');
            values.push(JSON.stringify({ ...currentSettings, ...updateData.settings }));
        }

        if (updates.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(officeId);

        await this.db.run(`UPDATE offices SET ${updates.join(', ')} WHERE id = ?`, values);

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
