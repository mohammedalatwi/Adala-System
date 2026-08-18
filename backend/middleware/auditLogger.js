const AuditService = require('../services/AuditService');

/**
 * Middleware to automatically audit log state-changing API operations.
 */
const auditLogger = (req, res, next) => {
    const sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    
    // Check if the request is a state-changing operation and user is logged in
    if (sensitiveMethods.includes(req.method) && req.session && req.session.userId) {
        const originalSend = res.send;
        
        res.send = function (body) {
            // Restore original send function
            res.send = originalSend;
            
            // Only audit successful requests to avoid clogging logs with bad requests
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const tenantId = req.session.tenantId || req.tenantId;
                const actorUserId = req.session.userId;
                
                // Format action: e.g. "post:/api/cases"
                const cleanPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
                const action = `${req.method.toLowerCase()}:${cleanPath}`;
                
                // Strip passwords or sensitive fields from body metadata
                const safeBody = { ...req.body };
                if (safeBody.password) safeBody.password = '[REDACTED]';
                if (safeBody.password_hash) safeBody.password_hash = '[REDACTED]';

                AuditService.log({
                    tenantId,
                    actorUserId,
                    action,
                    targetType: 'api_route',
                    targetId: actorUserId, // Default to user's own ID as target for general request logs
                    metadata: {
                        ip: req.ip,
                        url: req.originalUrl,
                        method: req.method,
                        params: req.params,
                        body: safeBody
                    }
                }).catch(err => console.error('Failed to log audit activity:', err));
            }
            
            return originalSend.apply(this, arguments);
        };
    }
    
    next();
};

module.exports = auditLogger;
