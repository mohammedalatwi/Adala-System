const BaseController = require('../utils/BaseController');
const db = require('../db/database');

class SystemController extends BaseController {
    // ✅ التحقق من حالة النظام
    checkHealth = this.asyncWrapper(async (req, res) => {
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');

        this.sendSuccess(res, {
            users_count: userCount ? userCount.count : 0,
            database: 'connected',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });
}

module.exports = new SystemController();
