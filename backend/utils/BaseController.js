/**
 * BaseController.js
 * Provides unified error handling and response formatting for all controllers.
 */
class BaseController {
    /**
     * Wrap an async function to catch errors and pass them to the next middleware.
     */
    asyncWrapper(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Send a success response.
     */
    sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    }

    /**
     * Send a created response.
     */
    sendCreated(res, data = null, message = 'Resource created successfully') {
        return this.sendSuccess(res, data, message, 201);
    }

    /**
     * Send an error response (can be used directly if not using error middleware).
     */
    sendError(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
        return res.status(statusCode).json({
            success: false,
            message,
            errors
        });
    }
}

module.exports = BaseController;
