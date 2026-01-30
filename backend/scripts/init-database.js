const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// إنشاء اتصال بقاعدة البيانات
const db = new sqlite3.Database('./database/adala.db', (err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
        process.exit(1);
    }
    console.log('✅ تم الاتصال بقاعدة البيانات');
});

// تفعيل المفاتيح الخارجية وتحسين الأداء
db.serialize(() => {
    // حذف الجداول القديمة لضمان تحديث الهيكلية
    const dropTables = `
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS settings;
        DROP TABLE IF EXISTS activities;
        DROP TABLE IF EXISTS expenses;
        DROP TABLE IF EXISTS payments;
        DROP TABLE IF EXISTS invoice_items;
        DROP TABLE IF EXISTS invoices;
        DROP TABLE IF EXISTS documents;
        DROP TABLE IF EXISTS sessions;
        DROP TABLE IF EXISTS cases;
        DROP TABLE IF EXISTS clients;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS offices;
    `;

    db.exec(dropTables, (err) => {
        if (err) console.error('Error dropping tables:', err);
        else console.log('✅ تم حذف الجداول القديمة');

        // إنشاء الجداول
        const createTables = `
            -- جدول المكاتب (المكاتب القانونية)
            CREATE TABLE IF NOT EXISTS offices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                logo_url TEXT,
                address TEXT,
                phone TEXT,
                email TEXT,
                settings_json TEXT DEFAULT '{}',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- جدول المستخدمين
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                phone TEXT,
                role TEXT DEFAULT 'lawyer' CHECK(role IN ('admin', 'lawyer', 'assistant', 'client', 'trainee')),
                specialization TEXT,
                license_number TEXT,
                experience_years INTEGER DEFAULT 0,
                bio TEXT,
                avatar_url TEXT,
                is_active BOOLEAN DEFAULT 1,
                last_login DATETIME,
                client_id INTEGER,
                supervisor_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                office_id INTEGER,
                FOREIGN KEY (client_id) REFERENCES clients (id),
                FOREIGN KEY (supervisor_id) REFERENCES users (id),
                FOREIGN KEY (office_id) REFERENCES offices (id)
            );

            -- جدول العملاء
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT,
                phone TEXT NOT NULL,
                alternate_phone TEXT,
                address TEXT,
                national_id TEXT UNIQUE,
                date_of_birth DATE,
                gender TEXT CHECK(gender IN ('male', 'female')),
                occupation TEXT,
                company TEXT,
                notes TEXT,
                emergency_contact_name TEXT,
                emergency_contact_phone TEXT,
                created_by INTEGER,
                is_active BOOLEAN DEFAULT 1,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            );
            
            -- ... باقي الجداول (يمكنك نسخها كما هي من الملف الأصلي أو إبقائها) ...
            -- (To keep the response short, I assume I don't need to repeat all tables if I'm not changing them, 
            -- BUT since I'm using replace_file_content on a large block, I must provide the full content or valid chunks.
            -- Since I am replacing the CREATE TABLES part, I must include ALL of them to avoid breaking the script structure if I replace a huge block.)
            
            -- (Let's stick to the instruction: I will provide the FULL createTables string with the fix)
            
            -- جدول القضايا
            CREATE TABLE IF NOT EXISTS cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_number TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                case_type TEXT NOT NULL CHECK(case_type IN ('مدني', 'جنائي', 'تجاري', 'أسرة', 'عمل', 'إداري')),
                client_id INTEGER NOT NULL,
                lawyer_id INTEGER NOT NULL,
                assistant_lawyer_id INTEGER,
                status TEXT DEFAULT 'جديد' CHECK(status IN ('جديد', 'قيد الدراسة', 'قيد التنفيذ', 'منتهي', 'ملغي', 'مؤجل')),
                priority TEXT DEFAULT 'متوسط' CHECK(priority IN ('منخفض', 'متوسط', 'عالي', 'عاجل')),
                court_name TEXT,
                court_type TEXT,
                judge_name TEXT,
                case_subject TEXT,
                legal_description TEXT,
                initial_claim_amount DECIMAL(15,2),
                expected_compensation DECIMAL(15,2),
                start_date DATE,
                expected_end_date DATE,
                actual_end_date DATE,
                next_session_date DATETIME,
                is_confidential BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                tags TEXT,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients (id),
                FOREIGN KEY (lawyer_id) REFERENCES users (id),
                FOREIGN KEY (assistant_lawyer_id) REFERENCES users (id)
            );

            -- جدول الجلسات
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                session_number INTEGER NOT NULL,
                session_date DATETIME NOT NULL,
                session_type TEXT CHECK(session_type IN ('استماع', 'نظر', 'تحكيم', 'إثبات', 'حكم')),
                location TEXT,
                judge_name TEXT,
                session_notes TEXT,
                session_result TEXT,
                decisions_taken TEXT,
                next_steps TEXT,
                status TEXT DEFAULT 'مجدول' CHECK(status IN ('مجدول', 'منعقد', 'ملغي', 'مؤجل', 'منتهي')),
                preparation_status TEXT DEFAULT 'غير معد' CHECK(preparation_status IN ('غير معد', 'قيد الإعداد', 'مكتمل')),
                documents_required TEXT,
                sent_reminders TEXT DEFAULT '[]', -- JSON array of sent intervals (e.g., ["7d", "3d"])
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            );

            -- جدول المستندات
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                session_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                document_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                file_type TEXT,
                version TEXT DEFAULT '1.0',
                is_active BOOLEAN DEFAULT 1,
                is_confidential BOOLEAN DEFAULT 0,
                uploaded_by INTEGER,
                office_id INTEGER,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id),
                FOREIGN KEY (session_id) REFERENCES sessions (id),
                FOREIGN KEY (uploaded_by) REFERENCES users (id)
            );

             -- جدول الفواتير
            CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                client_id INTEGER NOT NULL,
                invoice_number TEXT UNIQUE NOT NULL,
                issue_date DATE NOT NULL,
                due_date DATE,
                amount DECIMAL(15,2) NOT NULL,
                paid_amount DECIMAL(15,2) DEFAULT 0,
                status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled')),
                notes TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id),
                FOREIGN KEY (client_id) REFERENCES clients (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            );

            -- جدول بنود الفاتورة
            CREATE TABLE IF NOT EXISTS invoice_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                quantity DECIMAL(10,2) DEFAULT 1,
                unit_price DECIMAL(15,2) NOT NULL,
                total DECIMAL(15,2) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
            );

            -- جدول المدفوعات
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payment_date DATE NOT NULL,
                payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
                reference_number TEXT,
                notes TEXT,
                recorded_by INTEGER,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices (id),
                FOREIGN KEY (recorded_by) REFERENCES users (id)
            );

            -- جدول المصروفات
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                title TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                expense_date DATE NOT NULL,
                category TEXT,
                payment_method TEXT,
                recipient TEXT,
                notes TEXT,
                receipt_url TEXT,
                is_billable BOOLEAN DEFAULT 0,
                invoice_id INTEGER,
                recorded_by INTEGER,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id),
                FOREIGN KEY (invoice_id) REFERENCES invoices (id),
                FOREIGN KEY (recorded_by) REFERENCES users (id)
            );

            -- جدول الأنشطة
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action_type TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                description TEXT,
                ip_address TEXT,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            -- جدول المهام
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                assigned_to INTEGER,
                due_date DATETIME,
                priority TEXT DEFAULT 'متوسط' CHECK(priority IN ('منخفض', 'متوسط', 'عالي', 'عاجل')),
                status TEXT DEFAULT 'قيد الانتظار' CHECK(status IN ('قيد الانتظار', 'قيد التنفيذ', 'مكتمل', 'ملغي')),
                notification_sent BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (case_id) REFERENCES cases (id),
                FOREIGN KEY (assigned_to) REFERENCES users (id)
            );

            -- جدول الإشعارات
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'danger')),
                is_read BOOLEAN DEFAULT 0,
                related_entity_type TEXT,
                related_entity_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                office_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );

            -- جدول الإعدادات
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- جدول إعدادات التنبيهات للمستخدمين
            CREATE TABLE IF NOT EXISTS notification_settings (
                user_id INTEGER PRIMARY KEY,
                reminder_intervals TEXT DEFAULT '["7d", "3d", "24h", "2h"]',
                email_enabled BOOLEAN DEFAULT 1,
                whatsapp_enabled BOOLEAN DEFAULT 0,
                sms_enabled BOOLEAN DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        `;

        db.exec(createTables, (err) => {
            if (err) {
                console.error('❌ خطأ في إنشاء الجداول:', err);
            } else {
                console.log('✅ تم إنشاء الجداول بنجاح');
                addSampleData();
            }
        });
    });
});

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
            db.run(`INSERT INTO invoices (id, case_id, client_id, invoice_number, issue_date, amount, status, created_by, office_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [1, 1, 1, 'INV-001', '2024-03-01', 5000.00, 'unpaid', 1, 1]);

            // بيانات الإعدادات الافتراضية
            db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['firm_name', 'نظام عدالة']);
            db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['firm_logo', null]);
            db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, ['primary_color', '#2563eb']);

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

console.log('🚀 بدء تهيئة قاعدة البيانات...');