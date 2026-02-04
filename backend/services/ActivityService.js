const db = require('../db/database');

class ActivityService {
    constructor() {
        this.db = db;
    }

    /**
     * Log a user activity to the database.
     */
    async logActivity({
        userId,
        actionType,
        description,
        entityType = null,
        entityId = null,
        ipAddress = null,
        userAgent = null,
        officeId = null
    }) {
        try {
            const sql = `
                INSERT INTO activities (
                    user_id, action_type, entity_type, entity_id, 
                    description, ip_address, user_agent, office_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                userId, actionType, entityType, entityId,
                description, ipAddress, userAgent, officeId
            ];

            await this.db.run(sql, params);
            return true;
        } catch (error) {
            console.error('ActivityService Error:', error);
            // We don't throw here to avoid failing primary actions due to logging failure
            return false;
        }
    }
}

module.exports = new ActivityService();
