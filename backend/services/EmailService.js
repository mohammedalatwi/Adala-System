const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    init() {
        // Try to load custom credentials
        let emailConfig = config.email;
        try {
            const customConfig = require('../config/email_credentials');
            if (customConfig && customConfig.user && customConfig.user !== 'your-email@example.com') {
                emailConfig = customConfig;
                console.log('✉️ Custom email credentials detected and loaded');
            }
        } catch (e) {
            // No custom config, fallback to default
        }

        if (!config.features.enableEmailNotifications && emailConfig === config.email) {
            console.log('✉️ Email notifications are disabled in config');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host: emailConfig.host,
                port: emailConfig.port,
                secure: emailConfig.secure,
                auth: {
                    user: emailConfig.user,
                    pass: emailConfig.pass
                }
            });
            console.log('✉️ Email service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize email service:', error);
        }
    }

    async sendEmail({ to, subject, text, html }) {
        if (!this.transporter) {
            console.warn('✉️ Email service not initialized or disabled. Skipping email.');
            return false;
        }

        try {
            const info = await this.transporter.sendMail({
                from: config.email.from,
                to,
                subject,
                text,
                html
            });
            console.log('✉️ Email sent:', info.messageId);
            return true;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            return false;
        }
    }

    // Helper for session reminders
    async sendSessionReminder(user, session, intervalText) {
        const subject = `تذكير: جلسة قادمة - ${session.case_title}`;
        const text = `أهلاً ${user.full_name}،
لديك جلسة ${session.session_type} للقضية "${session.case_title}" بعد ${intervalText}.
التاريخ: ${new Date(session.session_date).toLocaleString('ar-SA')}
المكان: ${session.location}`;

        return this.sendEmail({
            to: user.email,
            subject,
            text
        });
    }

    // Helper for overdue tasks
    async sendTaskOverdueAlert(user, task) {
        const subject = `تنبيه: مهمة متأخرة - ${task.title}`;
        const text = `أهلاً ${user.full_name}،
المهمة "${task.title}" المرتبطة بالقضية "${task.case_title}" قد تجاوزت تاريخ الاستحقاق (${new Date(task.due_date).toLocaleDateString('ar-SA')}).
يرجى مراجعة المهمة في النظام.`;

        return this.sendEmail({
            to: user.email,
            subject,
            text
        });
    }
}

module.exports = new EmailService();
