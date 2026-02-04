const db = require('../db/database');
const ActivityService = require('./ActivityService');

class ClientService {
    constructor() {
        this.db = db;
    }

    async createClient(clientData, userId, officeId) {
        const {
            full_name, email, phone, alternate_phone, address, national_id,
            date_of_birth, gender, occupation, company, notes,
            emergency_contact_name, emergency_contact_phone
        } = clientData;

        if (national_id) {
            const existingClient = await this.db.get(
                'SELECT id FROM clients WHERE national_id = ? AND office_id = ?',
                [national_id, officeId]
            );
            if (existingClient) throw new Error('الرقم الوطني موجود مسبقاً');
        }

        const result = await this.db.run(
            `INSERT INTO clients (
                full_name, email, phone, alternate_phone, address, national_id,
                date_of_birth, gender, occupation, company, notes,
                emergency_contact_name, emergency_contact_phone, created_by, office_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                full_name, email, phone, alternate_phone, address, national_id,
                date_of_birth, gender, occupation, company, notes,
                emergency_contact_name, emergency_contact_phone, userId, officeId
            ]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'client',
            entityId: result.id,
            description: `إنشاء عميل جديد: ${full_name}`,
            officeId
        });

        return { id: result.id, full_name, phone };
    }

    async updateClient(clientId, updateData, userId, officeId) {
        const existingClient = await this.db.get('SELECT id, full_name FROM clients WHERE id = ? AND office_id = ? AND is_active = 1', [clientId, officeId]);
        if (!existingClient) throw new Error('العميل غير موجود');

        const allowedFields = [
            'full_name', 'email', 'phone', 'alternate_phone', 'address',
            'national_id', 'date_of_birth', 'gender', 'occupation',
            'company', 'notes', 'emergency_contact_name', 'emergency_contact_phone'
        ];

        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (updates.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updates.push('updated_at = datetime("now")');
        values.push(clientId, officeId);

        await this.db.run(`UPDATE clients SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`, values);

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'client',
            entityId: clientId,
            description: `تحديث بيانات العميل: ${existingClient.full_name}`,
            officeId
        });

        return true;
    }

    async deleteClient(clientId, userId, officeId) {
        const existingClient = await this.db.get('SELECT id, full_name FROM clients WHERE id = ? AND office_id = ? AND is_active = 1', [clientId, officeId]);
        if (!existingClient) throw new Error('العميل غير موجود');

        const casesCount = await this.db.get('SELECT COUNT(*) as count FROM cases WHERE client_id = ? AND office_id = ?', [clientId, officeId]);
        if (casesCount.count > 0) throw new Error('لا يمكن حذف العميل لأنه مرتبط بقضايا');

        await this.db.run('UPDATE clients SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND office_id = ?', [clientId, officeId]);

        await ActivityService.logActivity({
            userId,
            actionType: 'delete',
            entityType: 'client',
            entityId: clientId,
            description: `حذف العميل: ${existingClient.full_name}`,
            officeId
        });

        return true;
    }
}

module.exports = new ClientService();
