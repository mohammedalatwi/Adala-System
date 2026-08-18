const prisma = require('../db/prisma');

class AuditService {
    /**
     * Records a security or system audit event to the database.
     * 
     * @param {Object} params
     * @param {string} params.tenantId - The tenant ID
     * @param {string} [params.actorUserId] - The user performing the action
     * @param {string} params.action - The identifier of the action (e.g. 'case.deleted')
     * @param {string} params.targetType - The type of resource targeted (e.g. 'case')
     * @param {string} params.targetId - The UUID of the resource targeted
     * @param {Object} [params.metadata] - Extra metadata about the action
     */
    async log({ tenantId, actorUserId, action, targetType, targetId, metadata = {} }) {
        try {
            // Prisma will automatically attach the tenantId if it's running inside the tenantContext,
            // but we explicitly define it here to be safe for offline/cron/worker actions as well.
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    actorUserId,
                    action,
                    targetType,
                    targetId,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null
                }
            });
        } catch (error) {
            console.error('❌ Failed to write audit log:', error);
        }
    }
}

module.exports = new AuditService();
