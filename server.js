const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware الأساسية
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend/public')));

// إعدادات الجلسة
app.use(session({
    name: 'adala_session',
    secret: 'adala-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// تهيئة قاعدة البيانات
const db = new sqlite3.Database('./database/adala.db', (err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات');
        
        // تفعيل المفاتيح الخارجية
        db.run('PRAGMA foreign_keys = ON');
        db.run('PRAGMA journal_mode = WAL');
    }
});

// ==================== Routes API ====================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'نظام عدالة يعمل بشكل صحيح',
        version: '1.0.0'
    });
});

// ==================== APIs المصادقة المتكاملة ====================

// تسجيل الدخول - نسخة محسنة
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 محاولة تسجيل دخول:', email);

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
            });
        }

        // البحث عن المستخدم في قاعدة البيانات
        db.get(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email],
            async (err, user) => {
                if (err) {
                    console.error('❌ خطأ في قاعدة البيانات:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'خطأ في الخادم'
                    });
                }

                if (!user) {
                    console.log('❌ المستخدم غير موجود:', email);
                    return res.status(401).json({
                        success: false,
                        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                    });
                }

                // التحقق من كلمة المرور
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                
                if (!isValidPassword) {
                    console.log('❌ كلمة المرور غير صحيحة للمستخدم:', email);
                    return res.status(401).json({
                        success: false,
                        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
                    });
                }

                // إنشاء الجلسة
                req.session.userId = user.id;
                req.session.userRole = user.role;
                req.session.userEmail = user.email;
                
                // تحديث آخر دخول
                db.run(
                    'UPDATE users SET last_login = datetime("now") WHERE id = ?',
                    [user.id]
                );

                // تسجيل النشاط
                db.run(
                    'INSERT INTO activities (user_id, action_type, description) VALUES (?, ?, ?)',
                    [user.id, 'login', 'تسجيل الدخول إلى النظام']
                );

                console.log('✅ تسجيل الدخول ناجح للمستخدم:', user.email);

                res.json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        specialization: user.specialization,
                        avatar_url: user.avatar_url
                    }
                });
            }
        );

    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء تسجيل الدخول'
        });
    }
});

// إنشاء حساب جديد
app.post('/api/auth/register', async (req, res) => {
    try {
        const {
            full_name,
            username,
            email,
            password,
            phone,
            role = 'lawyer',
            specialization
        } = req.body;

        console.log('👤 محاولة إنشاء حساب جديد:', email);

        // التحقق من البيانات المطلوبة
        if (!full_name || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول المطلوبة يجب ملؤها'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
            });
        }

        // التحقق من عدم وجود مستخدم بنفس البريد أو اسم المستخدم
        db.get(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username],
            async (err, existingUser) => {
                if (err) {
                    console.error('❌ خطأ في التحقق من المستخدم:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'خطأ في الخادم'
                    });
                }

                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'البريد الإلكتروني أو اسم المستخدم موجود مسبقاً'
                    });
                }

                // تشفير كلمة المرور
                const saltRounds = 10;
                const passwordHash = await bcrypt.hash(password, saltRounds);

                // إضافة المستخدم الجديد
                db.run(
                    `INSERT INTO users (
                        full_name, username, email, password_hash, phone, role, specialization
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [full_name, username, email, passwordHash, phone, role, specialization],
                    function(err) {
                        if (err) {
                            console.error('❌ خطأ في إنشاء المستخدم:', err);
                            return res.status(500).json({
                                success: false,
                                message: 'حدث خطأ أثناء إنشاء الحساب'
                            });
                        }

                        const userId = this.lastID;

                        // تسجيل النشاط
                        db.run(
                            'INSERT INTO activities (user_id, action_type, description) VALUES (?, ?, ?)',
                            [userId, 'register', `إنشاء حساب جديد: ${full_name}`]
                        );

                        console.log('✅ تم إنشاء حساب جديد:', email);

                        res.status(201).json({
                            success: true,
                            message: 'تم إنشاء الحساب بنجاح',
                            data: { 
                                id: userId,
                                full_name: full_name,
                                email: email
                            }
                        });
                    }
                );
            }
        );

    } catch (error) {
        console.error('❌ خطأ في إنشاء الحساب:', error);
        res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إنشاء الحساب'
        });
    }
});

// تسجيل الخروج
app.post('/api/auth/logout', (req, res) => {
    // تسجيل النشاط قبل تدمير الجلسة
    if (req.session.userId) {
        db.run(
            'INSERT INTO activities (user_id, action_type, description) VALUES (?, ?, ?)',
            [req.session.userId, 'logout', 'تسجيل الخروج من النظام']
        );
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('❌ خطأ في تسجيل الخروج:', err);
            return res.status(500).json({
                success: false,
                message: 'فشل في تسجيل الخروج'
            });
        }
        
        res.json({ 
            success: true, 
            message: 'تم تسجيل الخروج بنجاح' 
        });
    });
});

// حالة المصادقة
app.get('/api/auth/status', (req, res) => {
    if (!req.session.userId) {
        return res.json({
            authenticated: false,
            user: null
        });
    }

    // جلب بيانات المستخدم من قاعدة البيانات
    db.get(
        `SELECT id, full_name, username, email, role, specialization, 
                avatar_url, created_at 
         FROM users 
         WHERE id = ? AND is_active = 1`,
        [req.session.userId],
        (err, user) => {
            if (err || !user) {
                // إذا لم يوجد المستخدم، تدمير الجلسة
                req.session.destroy();
                return res.json({
                    authenticated: false,
                    user: null
                });
            }

            res.json({
                authenticated: true,
                user: user
            });
        }
    );
});

// التحقق من توفر اسم المستخدم
app.get('/api/auth/check-username/:username', (req, res) => {
    const { username } = req.params;

    db.get(
        'SELECT id FROM users WHERE username = ?',
        [username],
        (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'خطأ في التحقق'
                });
            }

            res.json({
                available: !user,
                message: user ? 'اسم المستخدم موجود مسبقاً' : 'اسم المستخدم متاح'
            });
        }
    );
});

// التحقق من توفر البريد الإلكتروني
app.get('/api/auth/check-email/:email', (req, res) => {
    const { email } = req.params;

    db.get(
        'SELECT id FROM users WHERE email = ?',
        [email],
        (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'خطأ في التحقق'
                });
            }

            res.json({
                available: !user,
                message: user ? 'البريد الإلكتروني موجود مسبقاً' : 'البريد الإلكتروني متاح'
            });
        }
    );
});

// تحديث بيانات المستخدم
app.put('/api/auth/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'يجب تسجيل الدخول'
        });
    }

    const { full_name, phone, specialization } = req.body;
    const updates = [];
    const values = [];

    if (full_name) {
        updates.push('full_name = ?');
        values.push(full_name);
    }

    if (phone) {
        updates.push('phone = ?');
        values.push(phone);
    }

    if (specialization) {
        updates.push('specialization = ?');
        values.push(specialization);
    }

    if (updates.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'لا توجد بيانات للتحديث'
        });
    }

    values.push(req.session.userId);

    db.run(
        `UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') 
         WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                console.error('❌ خطأ في تحديث الملف الشخصي:', err);
                return res.status(500).json({
                    success: false,
                    message: 'خطأ في تحديث البيانات'
                });
            }

            res.json({
                success: true,
                message: 'تم تحديث البيانات بنجاح'
            });
        }
    );
});

// ==================== APIs القضايا المصححة ====================

// جلب جميع القضايا (مع فلترة)
app.get('/api/cases', (req, res) => {
    const { search, status, type } = req.query;
    
    let query = `
        SELECT c.*, cl.full_name as client_name 
        FROM cases c 
        LEFT JOIN clients cl ON c.client_id = cl.id 
        WHERE 1=1
    `;
    let params = [];

    if (search) {
        query += ' AND (c.title LIKE ? OR c.case_number LIKE ? OR cl.full_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND c.status = ?';
        params.push(status);
    }

    if (type) {
        query += ' AND c.case_type = ?';
        params.push(type);
    }

    query += ' ORDER BY c.created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب القضايا:', err);
            res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
        } else {
            console.log(`✅ تم جلب ${rows ? rows.length : 0} قضية`);
            res.json({ 
                success: true, 
                data: rows || [] 
            });
        }
    });
});

// جلب جميع القضايا بدون فلترة (للقوائم المنسدلة)
app.get('/api/cases/all', (req, res) => {
    console.log('🔍 جلب جميع القضايا...');
    
    const query = `SELECT id, case_number, title FROM cases ORDER BY created_at DESC`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب جميع القضايا:', err);
            res.status(500).json({ 
                success: false, 
                message: 'خطأ في جلب القضايا' 
            });
        } else {
            console.log(`✅ تم جلب ${rows ? rows.length : 0} قضية`);
            res.json({ 
                success: true, 
                data: rows || []
            });
        }
    });
});

// جلب القضايا النشطة للقائمة المنسدلة
app.get('/api/cases/active', (req, res) => {
    console.log('🔍 جلب القضايا النشطة...');
    
    const query = `SELECT id, case_number, title FROM cases ORDER BY created_at DESC`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب القضايا النشطة:', err);
            res.status(500).json({ 
                success: false, 
                message: 'خطأ في جلب القضايا' 
            });
        } else {
            console.log(`✅ تم جلب ${rows ? rows.length : 0} قضية نشطة`);
            res.json({ 
                success: true, 
                data: rows || []
            });
        }
    });
});

// التحقق من وجود قضايا
app.get('/api/cases/check', (req, res) => {
    console.log('🔍 التحقق من وجود قضايا...');
    
    db.get('SELECT COUNT(*) as count FROM cases', (err, result) => {
        if (err) {
            console.error('❌ خطأ في التحقق من القضايا:', err);
            res.json({ exists: false, count: 0 });
        } else {
            const exists = result && result.count > 0;
            console.log(`✅ حالة القضايا: ${exists ? 'موجودة' : 'غير موجودة'} (${result ? result.count : 0} قضية)`);
            res.json({ 
                exists: exists, 
                count: result ? result.count : 0 
            });
        }
    });
});

// جلب قضية محددة
app.get('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    
    db.get(`
        SELECT c.*, cl.full_name as client_name, cl.phone as client_phone 
        FROM cases c 
        LEFT JOIN clients cl ON c.client_id = cl.id 
        WHERE c.id = ?
    `, [id], (err, row) => {
        if (err) {
            console.error('❌ خطأ في جلب القضية:', err);
            res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
        } else if (!row) {
            res.status(404).json({ success: false, message: 'القضية غير موجودة' });
        } else {
            res.json({ success: true, data: row });
        }
    });
});

// إضافة قضية جديدة
app.post('/api/cases', (req, res) => {
    const {
        case_number, title, description, case_type, client_id, lawyer_id,
        status, priority, court_name, start_date
    } = req.body;

    // توليد رقم قضية تلقائي إذا لم يتم تقديمه
    const finalCaseNumber = case_number || `CASE-${Date.now()}`;

    // استخدام القيم الافتراضية إذا لم يتم تقديمها
    const finalClientId = client_id || 1;
    const finalLawyerId = lawyer_id || 1;
    const finalStatus = status || 'جديد';
    const finalPriority = priority || 'متوسط';

    db.run(`
        INSERT INTO cases (
            case_number, title, description, case_type, client_id, lawyer_id,
            status, priority, court_name, start_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        finalCaseNumber, title, description, case_type, finalClientId, finalLawyerId,
        finalStatus, finalPriority, court_name, start_date
    ], function(err) {
        if (err) {
            console.error('❌ خطأ في إضافة القضية:', err);
            res.status(500).json({ success: false, message: 'خطأ في إضافة القضية' });
        } else {
            console.log('✅ تم إضافة قضية جديدة:', finalCaseNumber);
            res.json({ 
                success: true, 
                message: 'تم إضافة القضية بنجاح',
                data: { id: this.lastID, case_number: finalCaseNumber }
            });
        }
    });
});

// تحديث قضية
app.put('/api/cases/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['title', 'description', 'case_type', 'status', 'priority', 'court_name', 'start_date'];
    const setClause = [];
    const values = [];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            setClause.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    if (setClause.length === 0) {
        return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }

    values.push(id);

    db.run(`
        UPDATE cases SET ${setClause.join(', ')}, updated_at = datetime('now') 
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('❌ خطأ في تحديث القضية:', err);
            res.status(500).json({ success: false, message: 'خطأ في تحديث القضية' });
        } else if (this.changes === 0) {
            res.status(404).json({ success: false, message: 'القضية غير موجودة' });
        } else {
            console.log('✅ تم تحديث القضية:', id);
            res.json({ success: true, message: 'تم تحديث القضية بنجاح' });
        }
    });
});

// حذف قضية
app.delete('/api/cases/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM cases WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ خطأ في حذف القضية:', err);
            res.status(500).json({ success: false, message: 'خطأ في حذف القضية' });
        } else if (this.changes === 0) {
            res.status(404).json({ success: false, message: 'القضية غير موجودة' });
        } else {
            console.log('✅ تم حذف القضية:', id);
            res.json({ success: true, message: 'تم حذف القضية بنجاح' });
        }
    });
});

// ==================== APIs الجلسات ====================

// جلب جميع الجلسات
app.get('/api/sessions', (req, res) => {
    const { case_id, status, upcoming } = req.query;
    
    let query = `
        SELECT s.*, c.case_number, c.title as case_title, cl.full_name as client_name 
        FROM sessions s 
        LEFT JOIN cases c ON s.case_id = c.id 
        LEFT JOIN clients cl ON c.client_id = cl.id 
        WHERE 1=1
    `;
    let params = [];

    if (case_id) {
        query += ' AND s.case_id = ?';
        params.push(case_id);
    }

    if (status) {
        query += ' AND s.status = ?';
        params.push(status);
    }

    if (upcoming === 'true') {
        query += ' AND s.session_date > datetime("now") AND s.status = "مجدول"';
    }

    query += ' ORDER BY s.session_date DESC';

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب الجلسات:', err);
            res.status(500).json({ success: false, message: 'خطأ في جلب الجلسات' });
        } else {
            console.log(`✅ تم جلب ${rows ? rows.length : 0} جلسة`);
            res.json({ success: true, data: rows || [] });
        }
    });
});

// جلب جلسة محددة
app.get('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    
    db.get(`
        SELECT s.*, c.case_number, c.title as case_title, cl.full_name as client_name 
        FROM sessions s 
        LEFT JOIN cases c ON s.case_id = c.id 
        LEFT JOIN clients cl ON c.client_id = cl.id 
        WHERE s.id = ?
    `, [id], (err, row) => {
        if (err) {
            console.error('❌ خطأ في جلب الجلسة:', err);
            res.status(500).json({ success: false, message: 'خطأ في جلب البيانات' });
        } else if (!row) {
            res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
        } else {
            res.json({ success: true, data: row });
        }
    });
});

// إضافة جلسة جديدة
app.post('/api/sessions', (req, res) => {
    const {
        case_id, session_number, session_date, session_type, location,
        judge_name, session_notes, status, preparation_status
    } = req.body;

    if (!case_id || !session_date) {
        return res.status(400).json({ success: false, message: 'حقل القضية وتاريخ الجلسة مطلوبان' });
    }

    // الحصول على آخر رقم جلسة لهذه القضية
    db.get('SELECT MAX(session_number) as max_number FROM sessions WHERE case_id = ?', [case_id], (err, result) => {
        if (err) {
            console.error('❌ خطأ في الحصول على رقم الجلسة:', err);
            return res.status(500).json({ success: false, message: 'خطأ في إضافة الجلسة' });
        }

        const finalSessionNumber = session_number || ((result.max_number || 0) + 1);
        const finalStatus = status || 'مجدول';
        const finalPreparationStatus = preparation_status || 'غير معد';

        db.run(`
            INSERT INTO sessions (
                case_id, session_number, session_date, session_type, location,
                judge_name, session_notes, status, preparation_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            case_id, finalSessionNumber, session_date, session_type, location,
            judge_name, session_notes, finalStatus, finalPreparationStatus, 1
        ], function(err) {
            if (err) {
                console.error('❌ خطأ في إضافة الجلسة:', err);
                res.status(500).json({ success: false, message: 'خطأ في إضافة الجلسة' });
            } else {
                console.log('✅ تم إضافة جلسة جديدة:', finalSessionNumber);
                res.json({ 
                    success: true, 
                    message: 'تم إضافة الجلسة بنجاح',
                    data: { id: this.lastID, session_number: finalSessionNumber }
                });
            }
        });
    });
});

// تحديث جلسة
app.put('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['session_number', 'session_date', 'session_type', 'location', 
                          'judge_name', 'session_notes', 'session_result', 'decisions_taken',
                          'next_steps', 'status', 'preparation_status', 'documents_required'];
    
    const setClause = [];
    const values = [];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            setClause.push(`${field} = ?`);
            values.push(updates[field]);
        }
    });

    if (setClause.length === 0) {
        return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }

    values.push(id);

    db.run(`
        UPDATE sessions SET ${setClause.join(', ')}, updated_at = datetime('now') 
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('❌ خطأ في تحديث الجلسة:', err);
            res.status(500).json({ success: false, message: 'خطأ في تحديث الجلسة' });
        } else if (this.changes === 0) {
            res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
        } else {
            console.log('✅ تم تحديث الجلسة:', id);
            res.json({ success: true, message: 'تم تحديث الجلسة بنجاح' });
        }
    });
});

// حذف جلسة
app.delete('/api/sessions/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM sessions WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('❌ خطأ في حذف الجلسة:', err);
            res.status(500).json({ success: false, message: 'خطأ في حذف الجلسة' });
        } else if (this.changes === 0) {
            res.status(404).json({ success: false, message: 'الجلسة غير موجودة' });
        } else {
            console.log('✅ تم حذف الجلسة:', id);
            res.json({ success: true, message: 'تم حذف الجلسة بنجاح' });
        }
    });
});

// ==================== APIs مساعدة ====================

// جلب العملاء
app.get('/api/clients', (req, res) => {
    console.log('🔍 جلب العملاء...');
    
    const query = `SELECT id, full_name, phone FROM clients WHERE is_active = 1 ORDER BY full_name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب العملاء:', err);
            res.status(500).json({ 
                success: false, 
                message: 'خطأ في جلب العملاء' 
            });
        } else {
            console.log(`✅ تم جلب ${rows ? rows.length : 0} عميل`);
            res.json({ 
                success: true, 
                data: rows || []
            });
        }
    });
});

// التحقق من حالة النظام
app.get('/api/system/status', (req, res) => {
    const status = {
        database: 'connected',
        tables: {},
        counts: {}
    };
    
    // التحقق من الجداول الرئيسية
    const tables = ['users', 'clients', 'cases', 'sessions'];
    let completedChecks = 0;
    
    tables.forEach(table => {
        db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, result) => {
            if (err) {
                status.tables[table] = 'error';
            } else {
                status.tables[table] = 'exists';
                status.counts[table] = result.count;
            }
            
            completedChecks++;
            
            // عندما تكتمل جميع الفحوصات
            if (completedChecks === tables.length) {
                res.json({
                    success: true,
                    data: status
                });
            }
        });
    });
});

// ==================== Routes الصفحات ====================
const pages = ['/', '/login', '/register', '/dashboard', '/cases', '/clients', '/sessions', '/documents'];

pages.forEach(route => {
    app.get(route, (req, res) => {
        let page = route === '/' ? 'index.html' : `${route.substring(1)}.html`;
        const filePath = path.join(__dirname, 'frontend/public', page);
        
        // التحقق من وجود الملف
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            // إذا لم يوجد الملف، إرسال صفحة login كبديل
            res.sendFile(path.join(__dirname, 'frontend/public', 'login.html'));
        }
    });
});

// Route لأي صفحة غير موجودة
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/public', 'login.html'));
});

// ==================== تشغيل الخادم ====================
app.listen(PORT, () => {
    console.log('🚀 ==================================');
    console.log('🚀 نظام إدارة مكاتب المحاماة - Adala');
    console.log('🚀 ==================================');
    console.log(`📍 الخادم: http://localhost:${PORT}`);
    console.log('⚖️  النظام جاهز للاستخدام!');
    console.log('🔐 المستخدم الافتراضي: admin@adala.com / password123');
    console.log('🚀 ==================================');
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    console.error('❌ خطأ غير متوقع:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ خطأ في Promise:', reason);
});

module.exports = app;