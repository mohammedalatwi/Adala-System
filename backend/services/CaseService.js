const db = require('../db/database');
const ActivityService = require('./ActivityService');

class CaseService {
    constructor() {
        this.db = db;
    }

    async createCase(caseData, userId, officeId) {
        const {
            case_number, title, description, case_type, client_id, lawyer_id,
            assistant_lawyer_id, status, priority, court_name, court_type,
            judge_name, case_subject, legal_description, initial_claim_amount,
            expected_compensation, start_date, expected_end_date, next_session_date,
            is_confidential, tags
        } = caseData;

        const trimmedCaseNumber = case_number ? case_number.toString().trim() : '';

        // Check uniqueness
        const existingCase = await this.db.get(
            'SELECT id FROM cases WHERE case_number = ? AND office_id = ?',
            [trimmedCaseNumber, officeId]
        );

        if (existingCase) {
            throw new Error('رقم القضية موجود مسبقاً');
        }

        const result = await this.db.run(
            `INSERT INTO cases (
                case_number, title, description, case_type, client_id, lawyer_id, 
                assistant_lawyer_id, status, priority, court_name, court_type, 
                judge_name, case_subject, legal_description, initial_claim_amount,
                expected_compensation, start_date, expected_end_date, next_session_date,
                is_confidential, tags, office_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                trimmedCaseNumber, title, description, case_type, client_id, lawyer_id || null,
                assistant_lawyer_id || null, status || 'جديد', priority || 'متوسط', court_name, court_type,
                judge_name, case_subject, legal_description, initial_claim_amount,
                expected_compensation, start_date, expected_end_date, next_session_date,
                is_confidential ? 1 : 0, tags, officeId
            ]
        );

        // Log activity
        await ActivityService.logActivity({
            userId,
            actionType: 'create',
            description: `إنشاء قضية جديدة: ${title}`,
            entityType: 'case',
            entityId: result.id,
            officeId
        });

        return { id: result.id, case_number: trimmedCaseNumber, title };
    }

    async updateCase(id, updateData, userId, officeId) {
        const existingCase = await this.db.get(
            'SELECT id, title FROM cases WHERE id = ? AND office_id = ?',
            [id, officeId]
        );

        if (!existingCase) {
            throw new Error('القضية غير موجودة');
        }

        if (updateData.case_number) {
            const trimmedNewNumber = updateData.case_number.toString().trim();
            const existingWithNum = await this.db.get(
                'SELECT id FROM cases WHERE case_number = ? AND office_id = ? AND id != ?',
                [trimmedNewNumber, officeId, id]
            );
            if (existingWithNum) {
                throw new Error('رقم القضية الجديد مستخدم بالفعل في قضية أخرى');
            }
            updateData.case_number = trimmedNewNumber;
        }

        const allowedFields = [
            'case_number', 'title', 'description', 'case_type', 'client_id', 'lawyer_id',
            'assistant_lawyer_id', 'status', 'priority', 'court_name',
            'court_type', 'judge_name', 'case_subject', 'legal_description',
            'initial_claim_amount', 'expected_compensation', 'start_date',
            'expected_end_date', 'actual_end_date', 'next_session_date',
            'is_confidential', 'tags'
        ];

        const updates = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = ?`);
                values.push(key === 'is_confidential' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        });

        if (updates.length === 0) {
            throw new Error('لا توجد بيانات لتحديثها');
        }

        updates.push('updated_at = datetime("now")');
        values.push(id, officeId);

        await this.db.run(
            `UPDATE cases SET ${updates.join(', ')} WHERE id = ? AND office_id = ?`,
            values
        );

        await ActivityService.logActivity({
            userId,
            actionType: 'update',
            description: `تحديث القضية: ${existingCase.title}`,
            entityType: 'case',
            entityId: id,
            officeId
        });

        return true;
    }
}

module.exports = new CaseService();
