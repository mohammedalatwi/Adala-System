const tenantStorage = require('../utils/tenantStorage');

/**
 * Middleware to establish the active tenant context for the current request.
 * Grabs the tenantId from the authenticated user's session.
 */
const tenantContext = (req, res, next) => {
    const tenantId = req.session.tenantId;

    if (tenantId) {
        // Run all subsequent operations inside this storage context
        tenantStorage.run({ tenantId }, () => {
            req.tenantId = tenantId;
            next();
        });
    } else {
        next();
    }
};

module.exports = tenantContext;
