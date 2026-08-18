const BaseController = require('../utils/BaseController');
const db = require('../db/database');

const CronService = require('../services/cronService');

class SystemController extends BaseController {
    // ✅ التحقق من حالة النظام
    checkHealth = this.asyncWrapper(async (req, res) => {
        await db.get('SELECT 1');

        this.sendSuccess(res, {
            database: 'connected',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    // ✅ تشغيل فحص يدوي للتنبيهات (للفحص)
    triggerManualCheck = this.asyncWrapper(async (req, res) => {
        if (req.session.userRole !== 'admin') throw new Error('غير مصرح لك');
        await CronService.runManualCheck();
        this.sendSuccess(res, null, 'تم تشغيل فحص التنبيهات يدوياً');
    });
}

module.exports = new SystemController();
