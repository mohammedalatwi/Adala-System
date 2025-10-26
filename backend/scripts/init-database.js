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
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    
    // إنشاء الجداول إذا لم تكن موجودة
    const createTables = `
        -- جدول المستخدمين
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            phone TEXT,
            role TEXT DEFAULT 'lawyer' CHECK(role IN ('admin', 'lawyer', 'assistant')),
            specialization TEXT,
            license_number TEXT,
            experience_years INTEGER DEFAULT 0,
            bio TEXT,
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT 1,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
        );

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
            tags TEXT,
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
            reminder_sent BOOLEAN DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES cases (id),
            FOREIGN KEY (created_by) REFERENCES users (id)
        );
    `;

    // تنفيذ إنشاء الجداول
    db.exec(createTables, (err) => {
        if (err) {
            console.error('❌ خطأ في إنشاء الجداول:', err);
        } else {
            console.log('✅ تم إنشاء الجداول بنجاح');
            
            // إضافة بيانات أولية
            addSampleData();
        }
    });
});

// إضافة بيانات أولية
async function addSampleData() {
    try {
        // إضافة مستخدم إداري
        const passwordHash = await bcrypt.hash('password123', 10);
        
        db.run(`
            INSERT OR IGNORE INTO users (id, full_name, username, email, password_hash, role, specialization, license_number) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [1, 'مدير النظام', 'admin', 'admin@adala.com', passwordHash, 'admin', 'إدارة النظام', 'ADMIN-001']);

        // إضافة عملاء
        db.run(`
            INSERT OR IGNORE INTO clients (id, full_name, email, phone, national_id, occupation, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [1, 'سعود العتيبي', 'saud@email.com', '0501234567', '1112223334', 'رجل أعمال', 1]);

        db.run(`
            INSERT OR IGNORE INTO clients (id, full_name, email, phone, national_id, occupation, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [2, 'نورة القحطاني', 'nora@email.com', '0559876543', '2223334445', 'طبيبة', 1]);

        // إضافة قضايا نموذجية
        db.run(`
            INSERT OR IGNORE INTO cases (id, case_number, title, case_type, client_id, lawyer_id, status, priority, court_name, start_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [1, 'CASE-2024-001', 'قضية تعويض عن ضرر مادي', 'مدني', 1, 1, 'قيد التنفيذ', 'عالي', 'محكمة الرياض الجزائية', '2024-01-15']);

        db.run(`
            INSERT OR IGNORE INTO cases (id, case_number, title, case_type, client_id, lawyer_id, status, priority, court_name, start_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [2, 'CASE-2024-002', 'قضية نزاع عقاري', 'مدني', 2, 1, 'قيد الدراسة', 'متوسط', 'محكمة الأسرة', '2024-01-10']);

        console.log('✅ تم إضافة البيانات الأولية بنجاح');
        
        // التحقق من البيانات المضافة
        db.all('SELECT COUNT(*) as cases_count FROM cases', (err, result) => {
            if (!err) {
                console.log(`📊 عدد القضايا في النظام: ${result[0].cases_count}`);
            }
        });
        
    } catch (error) {
        console.error('❌ خطأ في إضافة البيانات الأولية:', error);
    } finally {
        // إغلاق الاتصال
        db.close((err) => {
            if (err) {
                console.error('❌ خطأ في إغلاق الاتصال:', err);
            } else {
                console.log('✅ تم إغلاق الاتصال بقاعدة البيانات');
            }
        });
    }
}

console.log('🚀 بدء تهيئة قاعدة البيانات...');