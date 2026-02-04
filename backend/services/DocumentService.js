const db = require('../db/database');
const ActivityService = require('./ActivityService');

class DocumentService {
    constructor() {
        this.db = db;
    }

    async createDocument(docData, fileData, userId, officeId) {
        if (!fileData) throw new Error('لم يتم رفع أي ملف');

        const {
            case_id,
            session_id,
            title,
            description,
            document_type,
            version = '1.0',
            is_confidential = false
        } = docData;

        // التحقق من وجود القضية أو الجلسة
        if (case_id) {
            const caseExists = await this.db.get('SELECT id FROM cases WHERE id = ? AND office_id = ?', [case_id, officeId]);
            if (!caseExists) throw new Error('القضية غير موجودة');
        }

        if (session_id) {
            const sessionExists = await this.db.get('SELECT id FROM sessions WHERE id = ? AND office_id = ?', [session_id, officeId]);
            if (!sessionExists) throw new Error('الجلسة غير موجودة');
        }

        const result = await this.db.run(
            `INSERT INTO documents (
                case_id, session_id, title, description, document_type,
                file_name, file_path, file_size, file_type, version,
                is_confidential, uploaded_by, office_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                case_id, session_id, title, description, document_type,
                fileData.originalname, fileData.path, fileData.size, fileData.mimetype, version,
                is_confidential ? 1 : 0, userId, officeId
            ]
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            entityType: 'document',
            entityId: result.id,
            description: `رفع مستند جديد: ${title}`,
            officeId
        });

        return { id: result.id, title, file_name: fileData.originalname };
    }

    async updateDocument(id, updateData, userId, officeId) {
        const existingDocument = await this.db.get('SELECT id, title FROM documents WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingDocument) throw new Error('المستند غير موجود');

        const allowedFields = ['title', 'description', 'document_type', 'version', 'is_confidential'];
        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(key === 'is_confidential' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        });

        if (updates.length === 0) throw new Error('لا توجد بيانات لتحديثها');

        updates.push('last_modified = datetime("now")');
        values.push(id, officeId);

        await this.db.run(`UPDATE documents SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`, values);

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            entityType: 'document',
            entityId: id,
            description: `تحديث المستند: ${existingDocument.title}`,
            officeId
        });

        return true;
    }

    async deleteDocument(id, userId, officeId) {
        const existingDocument = await this.db.get('SELECT id, title FROM documents WHERE id = ? AND office_id = ?', [id, officeId]);
        if (!existingDocument) throw new Error('المستند غير موجود');

        await this.db.run('UPDATE documents SET is_active = 0 WHERE id = ? AND office_id = ?', [id, officeId]);

        await ActivityService.logActivity({
            userId,
            actionType: 'delete',
            entityType: 'document',
            entityId: id,
            description: `حذف المستند (Soft Delete): ${existingDocument.title}`,
            officeId
        });

        return true;
    }
}

module.exports = new DocumentService();
