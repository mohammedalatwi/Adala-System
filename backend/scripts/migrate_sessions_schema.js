const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config/config');

const dbPath = path.resolve(__dirname, '../../database/adala.db');

console.log('Opening DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        process.exit(1);
    }
    console.log('Connected to DB.');
});

const addColumn = (table, column, definition) => {
    return new Promise((resolve) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log(`Column ${column} already exists in ${table}.`);
                } else {
                    console.error(`Error adding column ${column} to ${table}:`, err.message);
                }
            } else {
                console.log(`Successfully added ${column} to ${table}.`);
            }
            resolve();
        });
    });
};

db.serialize(async () => {
    await addColumn('sessions', 'is_active', 'BOOLEAN DEFAULT 1');

    db.close((err) => {
        if (err) console.error(err);
        else console.log('Closed DB connection.');
    });
});
