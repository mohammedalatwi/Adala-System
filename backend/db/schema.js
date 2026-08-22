/**
 * تعريف جداول قاعدة البيانات — المصدر الوحيد للحقيقة.
 *
 * يستهلكه طرفان لا ثالث لهما:
 *   • backend/scripts/init-database.js — يحذف ثم ينشئ الجداول ويزرع بيانات تجريبية
 *   • backend/tests/setup/testDb.js    — ينشئ الجداول فقط في قاعدة مؤقتة لكل ملف اختبار
 *
 * كان التعريف مكررًا في الملفين فانحرفا: نقص schema الاختبارات أربعة جداول
 * (expenses, invoice_items, notification_settings, session_reminders) وأعمدة في
 * أربعة أخرى، فكان أي اختبار جديد لمسارات المالية أو المستندات أو الإعدادات يفشل
 * بخطأ "no such table" بدل خطأ منطقي. أي جدول أو عمود يُضاف هنا يصل الطرفين معًا.
 *
 * ملف database/schema.sql كان تعريفًا ثالثًا مهجورًا (بلا جدول offices وبلا أعمدة
 * office_id وبأدوار مستخدمين لم تعد قائمة) وحُذف عند إنشاء هذا الملف.
 *
 * هذه الوحدة نصوص SQL فقط بلا أي أثر جانبي — لا تفتح اتصالًا ولا تكتب شيئًا،
 * حتى يستوردها سكريبت التهيئة والاختبارات بأمان.
 */

// ترتيب الحذف معكوس لترتيب الإنشاء احترامًا للمفاتيح الأجنبية
const DROP_TABLES = `
DROP TABLE IF EXISTS session_reminders;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS tasks;
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

const CREATE_TABLES = `
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
    adjournment_reason TEXT,
    attendees TEXT,
    city TEXT,
    judgment_content TEXT,
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
    user_agent TEXT,
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

-- جدول تذكيرات الجلسات
CREATE TABLE IF NOT EXISTS session_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);
`;

module.exports = { CREATE_TABLES, DROP_TABLES };
