const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../database/adala.db');

if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const tables = [
    'users', 'clients', 'cases', 'sessions', 'documents',
    'invoices', 'payments', 'expenses', 'activities', 'tasks', 'notifications'
];

db.serialize(() => {
    console.log('🚀 Starting migration: Adding office_id to tables...');

    tables.forEach(table => {
        // We use a try-catch pattern in SQL or just ignore the error if column exists
        db.run(`ALTER TABLE ${table} ADD COLUMN office_id INTEGER DEFAULT 1`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`ℹ️ Column office_id already exists in ${table}`);
                } else {
                    console.error(`❌ Error updating ${table}:`, err.message);
                }
            } else {
                console.log(`✅ Added office_id to ${table}`);
            }
        });
    });
});

setTimeout(() => {
    db.close();
    console.log('🏁 Migration finished');
}, 5000);
