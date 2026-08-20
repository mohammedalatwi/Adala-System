const sqlite3 = require('sqlite3').verbose();

/**
 * Minimal schema covering only the tables exercised by the integration tests
 * (offices, users, clients, cases). Mirrors the CREATE TABLE statements in
 * backend/scripts/init-database.js, which is the actual schema the running
 * app uses (database/schema.sql is stale and missing office_id columns).
 */
const SCHEMA = `
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

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'lawyer' CHECK(role IN ('admin', 'lawyer', 'client', 'trainee')),
        specialization TEXT,
        license_number TEXT,
        experience_years INTEGER DEFAULT 0,
        bio TEXT,
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        must_change_password BOOLEAN DEFAULT 0,
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

    -- الجداول التالية فارغة لكنها مطلوبة لأن استعلامات clientController/caseController
    -- تعمل JOIN/subquery عليها حتى عند جلب قائمة العملاء أو القضايا.
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        session_number INTEGER,
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
        adjournment_reason TEXT,
        attendees TEXT,
        city TEXT,
        judgment_content TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        office_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        uploaded_by INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        office_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        client_id INTEGER NOT NULL,
        amount DECIMAL(15,2),
        paid_amount DECIMAL(15,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        office_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT,
        reference_number TEXT,
        office_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        office_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to INTEGER,
        due_date DATETIME,
        priority TEXT DEFAULT 'متوسط',
        status TEXT DEFAULT 'قيد الانتظار',
        is_active BOOLEAN DEFAULT 1,
        office_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT 0,
        related_entity_type TEXT,
        related_entity_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        office_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`;

function createTestDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const conn = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
            conn.exec(SCHEMA, (execErr) => {
                conn.close();
                if (execErr) return reject(execErr);
                resolve();
            });
        });
    });
}

module.exports = { createTestDatabase };
