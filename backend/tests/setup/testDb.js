const sqlite3 = require('sqlite3').verbose();
// نفس تعريف الجداول الذي يستخدمه backend/scripts/init-database.js للقاعدة الحقيقية.
// كان هذا الملف يحمل نسخة مقصوصة من التعريف فانحرفت عن الحقيقي: نقصتها أربعة جداول
// وأعمدة في أربعة أخرى، فكان أي اختبار جديد لمسارات المالية أو المستندات أو الإعدادات
// يفشل بـ"no such table" بدل أن يفشل لسبب منطقي. الاستيراد يمنع تكرار ذلك.
const { CREATE_TABLES } = require('../../db/schema');

/**
 * ينشئ قاعدة بيانات اختبار كاملة الجداول وفارغة من البيانات في المسار المعطى.
 *
 * البيانات التجريبية التي يزرعها init-database.js متروكة عمدًا خارج هذه الدالة:
 * كل ملف اختبار يبني بيانات نفسه، ومعرّفات البيانات التجريبية الثابتة كانت
 * ستتعارض مع قيود UNIQUE على username/email/national_id/case_number.
 */
function createTestDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const conn = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            conn.exec(CREATE_TABLES, (execErr) => {
                conn.close();
                if (execErr) return reject(execErr);
                resolve();
            });
        });
    });
}

module.exports = { createTestDatabase };
