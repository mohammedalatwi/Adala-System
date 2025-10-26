-- نظام إدارة مكاتب المحاماة - النسخة المتكاملة

-- جدول المستخدمين (مطوّر)
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

-- جدول العملاء (مطوّر)
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

-- جدول القضايا (مطوّر)
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

-- جدول الجلسات (مطوّر)
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

-- جدول المستندات (مطوّر)
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    session_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    document_type TEXT CHECK(document_type IN ('عقد', 'طلب', 'مذكرة', 'حكم', 'شهادة', 'تقارير', 'أخرى')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    version TEXT DEFAULT '1.0',
    is_confidential BOOLEAN DEFAULT 0,
    uploaded_by INTEGER,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases (id),
    FOREIGN KEY (session_id) REFERENCES sessions (id),
    FOREIGN KEY (uploaded_by) REFERENCES users (id)
);

-- جدول المهام والتذكيرات
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to INTEGER,
    assigned_by INTEGER,
    related_case_id INTEGER,
    related_session_id INTEGER,
    due_date DATETIME,
    priority TEXT DEFAULT 'متوسط' CHECK(priority IN ('منخفض', 'متوسط', 'عالي')),
    status TEXT DEFAULT 'معلق' CHECK(status IN ('معلق', 'قيد التنفيذ', 'مكتمل', 'ملغي')),
    task_type TEXT CHECK(task_type IN ('مستند', 'بحث', 'اتصال', 'زيارة', 'مراجعة', 'أخرى')),
    completion_notes TEXT,
    reminder_sent BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users (id),
    FOREIGN KEY (assigned_by) REFERENCES users (id),
    FOREIGN KEY (related_case_id) REFERENCES cases (id),
    FOREIGN KEY (related_session_id) REFERENCES sessions (id)
);

-- جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK(type IN ('info', 'warning', 'success', 'error', 'reminder')),
    related_entity_type TEXT CHECK(related_entity_type IN ('case', 'session', 'task', 'document', 'client')),
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    action_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- جدول الأنشطة
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- جدول الإعدادات
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'text',
    description TEXT,
    updated_by INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users (id)
);

-- جدول الرسوم والمبالغ المالية
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_type TEXT CHECK(payment_type IN ('رسوم', 'سلفة', 'تسوية', 'أتعاب', 'مصاريف')),
    payment_method TEXT CHECK(payment_method IN ('نقدي', 'تحويل', 'شيك')),
    payment_date DATE NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'مستحق' CHECK(status IN ('مستحق', 'مدفوع', 'متأخر', 'ملغي')),
    reference_number TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases (id),
    FOREIGN KEY (client_id) REFERENCES clients (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_id ON cases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_sessions_case_id ON sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id);

-- بيانات أولية
INSERT OR IGNORE INTO users (full_name, username, email, password_hash, role, specialization, license_number, experience_years) VALUES 
('مدير النظام', 'admin', 'admin@adala.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'إدارة النظام', 'ADMIN-001', 10),
('أحمد محمد', 'ahmed_lawyer', 'ahmed@lawfirm.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lawyer', 'القانون التجاري', 'SA-12345', 8),
('فاطمة عبدالله', 'fatima_lawyer', 'fatima@lawfirm.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lawyer', 'قانون الأسرة', 'SA-67890', 5),
('خالد سليمان', 'khaled_assistant', 'khaled@lawfirm.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'assistant', 'المساعدة القانونية', 'SA-54321', 2);

INSERT OR IGNORE INTO clients (full_name, email, phone, national_id, address, occupation, created_by) VALUES 
('سعود العتيبي', 'saud@email.com', '0501234567', '1112223334', 'الرياض - حي الملز', 'رجل أعمال', 1),
('نورة القحطاني', 'nora@email.com', '0559876543', '2223334445', 'جدة - حي الصفا', 'طبيبة', 1),
('محمد الحربي', 'mohammed@email.com', '0545556667', '3334445556', 'الدمام - حي الشاطئ', 'مهندس', 1),
('لطيفة السبيعي', 'latifa@email.com', '0531112223', '4445556667', 'الرياض - حي النخيل', 'معلمة', 1);

INSERT OR IGNORE INTO cases (case_number, title, case_type, client_id, lawyer_id, status, priority, court_name, start_date) VALUES 
('CASE-2024-001', 'قضية تعويض عن ضرر مادي', 'مدني', 1, 2, 'قيد التنفيذ', 'عالي', 'محكمة الرياض الجزائية', '2024-01-15'),
('CASE-2024-002', 'قضية نزاع عقاري', 'مدني', 2, 3, 'قيد الدراسة', 'متوسط', 'محكمة الأسرة', '2024-01-10'),
('CASE-2024-003', 'قضية نزاع تجاري', 'تجاري', 3, 2, 'جديد', 'عاجل', 'محكمة التجارة', '2024-01-20'),
('CASE-2024-004', 'قضية حضانة أطفال', 'أسرة', 4, 3, 'قيد التنفيذ', 'عالي', 'محكمة الأسرة', '2024-01-05');

INSERT OR IGNORE INTO sessions (case_id, session_number, session_date, session_type, location, judge_name, status) VALUES 
(1, 1, '2024-01-25 10:00:00', 'استماع', 'محكمة الرياض - قاعة 5', 'القاضي محمد العلي', 'مجدول'),
(1, 2, '2024-02-01 14:00:00', 'نظر', 'محكمة الرياض - قاعة 3', 'القاضي محمد العلي', 'مجدول'),
(2, 1, '2024-01-30 09:00:00', 'استماع', 'محكمة الأسرة - قاعة 2', 'القاضية فاطمة أحمد', 'مجدول');

INSERT OR IGNORE INTO settings (setting_key, setting_value, description) VALUES 
('firm_name', 'مكتب المحاماة المتخصص', 'اسم المكتب القانوني'),
('firm_address', 'الرياض - المملكة العربية السعودية', 'عنوان المكتب'),
('firm_phone', '+966112345678', 'هاتف المكتب'),
('firm_email', 'info@adala.com', 'البريد الإلكتروني للمكتب'),
('default_currency', 'SAR', 'العملة الافتراضية'),
('session_reminder_days', '3', 'عدد الأيام لإرسال تذكير الجلسات'),
('case_auto_number', 'CASE-2024-', 'بادئة أرقام القضايا');

-- إشعارات نموذجية
INSERT OR IGNORE INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES 
(2, 'جلسة قريبة', 'جلسة قضية التعويض غداً الساعة 10:00 صباحاً', 'warning', 'session', 1),
(3, 'مستند مطلوب', 'يرجى إعداد مذكرة الدفاع للجلسة القادمة', 'info', 'case', 2),
(2, 'تذكير مهم', 'موعد تسليم المستندات النهائية يقترب', 'reminder', 'task', 1);