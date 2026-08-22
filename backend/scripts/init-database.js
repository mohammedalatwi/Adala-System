const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
// تعريف الجداول مشترك مع اختبارات backend/tests/setup/testDb.js حتى لا ينحرف الاثنان
const { CREATE_TABLES, DROP_TABLES } = require('../db/schema');

// مسار قاعدة البيانات يأتي من config (الذي يقرأ DB_PATH) وليس مسارًا ثابتًا،
// حتى لا يختلف السكريبت عن التطبيق ويكتب في قاعدة بيانات غير المقصودة.
const DB_PATH = config.database.path;

// --force مطلوب للكتابة فوق قاعدة بيانات تحتوي على بيانات فعلية
const FORCE = process.argv.includes('--force');

// عدد صفوف البيانات التجريبية: أي عدد أكبر منه يعني وجود بيانات حقيقية
const SAMPLE_USERS = 2;
const SAMPLE_CLIENTS = 2;

console.log('🚀 بدء تهيئة قاعدة البيانات...');
console.log(`📂 قاعدة البيانات المستهدفة: ${DB_PATH}`);
console.log('⚠️  تحذير: هذا السكريبت يحذف كل الجداول ثم يعيد إنشاءها بالبيانات التجريبية.');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    }
    console.log('✅ تم الاتصال بقاعدة البيانات');
    guardExistingData();
});

/**
 * عدّ صفوف جدول واحد. الجدول غير الموجود (قاعدة بيانات جديدة) يعني صفرًا.
 */
function countRows(table) {
    return new Promise((resolve) => {
        db.get(`SELECT COUNT(*) AS n FROM ${table}`, (err, row) => {
            if (err) return resolve(0);
            resolve(row ? row.n : 0);
        });
    });
}

/**
 * يمنع حذف قاعدة بيانات تحتوي على بيانات حقيقية إلا عند تمرير --force.
 * السبب: تشغيل `npm run init-db` بالخطأ على قاعدة الإنتاج يمحو كل شيء بلا رجعة.
 */
async function guardExistingData() {
    const users = await countRows('users');
    const clients = await countRows('clients');
    const hasRealData = users > SAMPLE_USERS || clients > SAMPLE_CLIENTS;

    console.log(`📊 المحتوى الحالي: ${users} مستخدم / ${clients} موكل.`);

    if (hasRealData && !FORCE) {
        console.error('');
        console.error('⛔ تم إيقاف العملية: قاعدة البيانات تحتوي على بيانات تتجاوز البيانات التجريبية.');
        console.error(`⛔ المسار: ${DB_PATH}`);
        console.error('⛔ المتابعة ستحذف هذه البيانات نهائيًا.');
        console.error('');
        console.error('   • للتهيئة في مسار آخر:      DB_PATH=/path/to/new.db npm run init-db');
        console.error('   • لتأكيد الحذف فعليًا:       npm run init-db -- --force');
        console.error('   • خذ نسخة احتياطية أولًا من database/backups/');
        console.error('');
        db.close(() => process.exit(1));
        return;
    }

    if (hasRealData && FORCE) {
        console.warn('⚠️  --force مُفعّل: سيتم حذف بيانات حقيقية موجودة في قاعدة البيانات!');
    }

    initSchema();
}

// تفعيل المفاتيح الخارجية وتحسين الأداء
function initSchema() {
    db.serialize(() => {
    // حذف الجداول القديمة لضمان تحديث الهيكلية
    db.exec(DROP_TABLES, (err) => {
        if (err) console.error('Error dropping tables:', err);
        else console.log('✅ تم حذف الجداول القديمة');

        // إنشاء الجداول
        db.exec(CREATE_TABLES, (err) => {
            if (err) {
                console.error('❌ خطأ في إنشاء الجداول:', err);
            } else {
                console.log('✅ تم إنشاء الجداول بنجاح');
                addSampleData();
            }
        });
    });
    });
}

async function addSampleData() {
    try {
        const passwordHash = await bcrypt.hash('password123', 10);

        db.serialize(() => {
            // إنشاء المكتب الرئيسي
            db.run(`INSERT INTO offices (id, name, address) VALUES (?, ?, ?)`,
                [1, 'المكتب الرئيسي', 'الرياض، المملكة العربية السعودية']);

            // بيانات المستخدمين
            db.run(`INSERT INTO users (id, full_name, username, email, password_hash, role, office_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [1, 'مدير النظام', 'admin', 'admin@adala.com', passwordHash, 'admin', 1]);

            // إنشاء حساب للعميل الأول
            db.run(`INSERT INTO users (id, full_name, username, email, password_hash, role, client_id, office_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [2, 'سعود العتيبي', 'saud', 'saud@client.com', passwordHash, 'client', 1, 1]);

            // بيانات العملاء
            db.run(`INSERT INTO clients (id, full_name, email, phone, national_id, created_by, office_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [1, 'سعود العتيبي', 'saud@email.com', '0501234567', '1112223334', 1, 1]);

            db.run(`INSERT INTO clients (id, full_name, email, phone, national_id, created_by, office_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [2, 'نورة القحطاني', 'nora@email.com', '0559876543', '2223334445', 1, 1]);

            // بيانات القضايا
            db.run(`INSERT INTO cases (id, case_number, title, case_type, client_id, lawyer_id, status, priority, start_date, office_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [1, 'CASE-001', 'قضية تعويض', 'مدني', 1, 1, 'قيد التنفيذ', 'عالي', '2024-01-01', 1]);

            db.run(`INSERT INTO cases (id, case_number, title, case_type, client_id, lawyer_id, status, priority, start_date, office_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [2, 'CASE-002', 'نزاع عقاري', 'مدني', 2, 1, 'جديد', 'متوسط', '2024-02-01', 1]);

            // بيانات الفواتير
            db.run(`INSERT INTO invoices (id, case_id, client_id, invoice_number, sequence_number, issue_date, amount, status, created_by, office_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [1, 1, 1, 'INV-2024-0001', 1, '2024-03-01', 5000.00, 'unpaid', 1, 1]);

            console.log('✅ تم إضافة البيانات الأولية');
        });
    } catch (e) {
        console.error(e);
    }
    // ملاحظة: لا نغلق الاتصال هنا لأن db.serialize قد تكون لا تزال تعمل
    // ولكن نظرًا لطبيعة هذا السكريبت البسيط، سنتركه ينهي العملية بشكل طبيعي أو نستخدم setTimeout إذا لزم الأمر
    setTimeout(() => {
        db.close((err) => {
            if (err) {
                console.error('❌ خطأ في إغلاق الاتصال:', err);
            } else {
                console.log('✅ تم إغلاق الاتصال بقاعدة البيانات');
            }
        });
    }, 2000);
}