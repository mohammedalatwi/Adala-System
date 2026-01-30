const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../../database/adala.db');

console.log('Opening DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error(err); process.exit(1); }
});

const checkTable = (table) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) console.error(err);
        else {
            console.log(`--- Columns in ${table} ---`);
            rows.forEach(r => console.log(`${r.name} (${r.type})`));
        }
    });
};

db.serialize(() => {
    checkTable('cases');
    checkTable('clients');
});

setTimeout(() => db.close(), 1000);
