const db = require('../db/database');

async function migrate() {
    console.log('📋 Running Phase 7 Migrations...');
    try {
        await db.init();
        await db.run(`
            CREATE TABLE IF NOT EXISTS session_reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        `);
        console.log('✅ Migration completed.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

migrate();
