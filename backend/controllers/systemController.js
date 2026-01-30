const db = require('../db/database');

class SystemController {
    // ✅ التحقق من حالة النظام
    checkHealth = async (req, res) => {
        try {
            const userCount = await db.get('SELECT COUNT(*) as count FROM users');

            res.json({
                success: true,
                data: {
                    users_count: userCount ? userCount.count : 0,
                    database: 'connected',
                    status: 'healthy',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                success: false,
                message: 'خطأ في قاعدة البيانات',
                error: error.message
            });
        }
    };
}

module.exports = new SystemController();
