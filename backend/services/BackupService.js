const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class BackupService {
    constructor() {
        this.dbPath = config.database.path;
        this.backupDir = config.database.backupPath;
        this.maxBackups = 7; // Keep last 7 days of backups
    }

    async runBackup() {
        if (!config.features.enableBackup) {
            console.log('💾 Automated backups are disabled');
            return;
        }

        try {
            // Ensure backup directory exists
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `adala-backup-${timestamp}.db`;
            const backupPath = path.join(this.backupDir, backupFileName);

            // Copy the database file
            fs.copyFileSync(this.dbPath, backupPath);
            console.log(`💾 Backup created successfully: ${backupFileName}`);

            // Cleanup old backups
            this.cleanupOldBackups();

            return { success: true, fileName: backupFileName };
        } catch (error) {
            console.error('❌ Backup failed:', error);
            return { success: false, error: error.message };
        }
    }

    cleanupOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(file => file.startsWith('adala-backup-'))
                .map(file => ({
                    name: file,
                    path: path.join(this.backupDir, file),
                    time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            if (files.length > this.maxBackups) {
                const toDelete = files.slice(this.maxBackups);
                toDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`💾 Deleted old backup: ${file.name}`);
                });
            }
        } catch (error) {
            console.error('❌ Error during backup cleanup:', error);
        }
    }
}

module.exports = new BackupService();
