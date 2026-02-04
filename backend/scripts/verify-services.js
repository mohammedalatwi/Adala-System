const BackupService = require('../services/BackupService');
const EmailService = require('../services/EmailService');
const config = require('../config/config');

async function verify() {
    console.log('🧪 Starting service verification...');

    // 1. Verify Backup
    console.log('\n--- 💾 Backup Verification ---');
    // Force enable for test if needed
    config.features.enableBackup = true;
    const backupResult = await BackupService.runBackup();
    if (backupResult.success) {
        console.log('✅ Backup verification successful');
    } else {
        console.log('❌ Backup verification failed:', backupResult.error);
    }

    // 2. Verify Email Logic
    console.log('\n--- ✉️ Email Logic Verification ---');
    // We won't send a real email without credentials, but let's check initialization
    if (EmailService.transporter) {
        console.log('✅ Email service transporter initialized (using provided credentials)');
    } else {
        console.log('ℹ️ Email service transporter not initialized (expected if no credentials provided)');
        console.log('🧪 Testing sendEmail skip logic...');
        const emailResult = await EmailService.sendEmail({
            to: 'test@example.com',
            subject: 'Test',
            text: 'Test content'
        });
        if (emailResult === false) {
            console.log('✅ Email service correctly skips sending when not initialized');
        }
    }

    console.log('\n🧪 Verification complete.');
}

verify().catch(err => console.error('Verification script crashed:', err));
