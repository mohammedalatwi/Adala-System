const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../../database/adala.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err);
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
    checkTable('sessions');
});

setTimeout(() => db.close(), 1000);
