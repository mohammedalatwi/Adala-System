const cron = require('node-cron');
const db = require('../db/database');
const notificationService = require('./notificationService');

class CronService {
    constructor() {
        this.initialized = false;
    }

    init() {
        console.log('⏰ Initializing Cron Services...');

        // Run every 30 minutes to catch all intervals (7d, 3d, 24h, 2h)
        cron.schedule('*/30 * * * *', async () => {
            console.log('⏰ Running periodic session check...');
            await notificationService.checkUpcomingSessions();
        });

        // Still run overdue tasks check daily (or more if needed)
        cron.schedule('0 9 * * *', async () => {
            console.log('⏰ Running daily task check...');
            await notificationService.checkOverdueTasks();
        });

        this.initialized = true;
        console.log('✅ Cron Services scheduled');
    }

    // Helper to run manually for testing/startup
    async runManualCheck() {
        console.log('⏰ Running manual checks...');
        await notificationService.checkUpcomingSessions();
        await notificationService.checkOverdueTasks();
    }

}

module.exports = new CronService();
