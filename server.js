const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const config = require('./backend/config/config');


// تهيئة التطبيق
const app = express();
const PORT = config.app.port;

// ==================== Middleware الأساسية ====================
// سياسة أمان المحتوى (CSP)
// المصادر الخارجية المسموح بها مأخوذة من مسح شامل لـ frontend/public:
//   cdn.jsdelivr.net      → Chart.js + FullCalendar (سكربت و CSS)
//   cdnjs.cloudflare.com  → Font Awesome (CSS + ملفات الخطوط معًا)
//   fonts.googleapis.com  → CSS خط Cairo
//   fonts.gstatic.com     → ملفات خط Cairo
//   www.transparenttextures.com → صورة خلفية في index.html فقط
//
// CSP_MODE يتحكم في الوضع: 'enforce' للتطبيق الفعلي (الافتراضي)، 'report-only'
// للرصد دون منع، 'off' للتعطيل.
//
// المرحلة الأولى (المطبَّقة الآن): script-src صارم بلا 'unsafe-inline' بعد تحويل
// كل معالجات onclick/onchange/onerror إلى addEventListener ونقل كل سكربتات
// <script> المضمّنة إلى ملفات خارجية. أما style-src فيبقى متساهلاً مؤقتاً لأن
// المشروع يحتوي أكثر من 700 سمة style= مضمّنة (المرحلة الثانية).
const CSP_MODE = process.env.CSP_MODE || 'enforce';

// وضع الرصد يعرض عمداً السياسة الأكثر صرامة (بدون 'unsafe-inline' في style-src)
// لقياس ما تبقّى من عمل المرحلة الثانية، وليس نسخة مما يُطبَّق فعلياً الآن.
const STYLE_SRC = ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'];
if (CSP_MODE !== 'report-only') {
    STYLE_SRC.splice(1, 0, "'unsafe-inline'");
}

const cspDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
    'style-src': STYLE_SRC,
    // data: مطلوب لأن FullCalendar يضمّن خط أيقوناته (fcicons) كـ base64
    'font-src': ["'self'", 'data:', 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'https://www.transparenttextures.com'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"]
};

// في وضع الرصد نضيف report-uri حتى تصل المخالفات إلى الخادم
if (CSP_MODE === 'report-only') {
    cspDirectives['report-uri'] = ['/api/csp-report'];
}

app.use(helmet({
    contentSecurityPolicy: CSP_MODE === 'off' ? false : {
        // useDefaults=false: نحدد كل التوجيهات صراحةً حتى لا يضيف helmet
        // توجيهات ضمنية (مثل upgrade-insecure-requests) تكسر التطوير على http.
        useDefaults: false,
        directives: cspDirectives,
        reportOnly: CSP_MODE === 'report-only'
    }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // same-origin / server-to-server requests
        if (allowedOrigins.length > 0) return callback(null, allowedOrigins.includes(origin));
        // لا يوجد ALLOWED_ORIGINS معرّف: سماح فقط خارج بيئة الإنتاج
        return callback(null, config.app.env !== 'production');
    },
    credentials: true
}));

app.use(express.json({ limit: config.upload.maxFileSize }));
app.use(express.urlencoded({ extended: true, limit: config.upload.maxFileSize }));
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== إعدادات الجلسة ====================
const SQLiteStore = require('connect-sqlite3')(session);

// ==================== إعدادات الجلسة ====================
app.use(session({
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.app.env === 'production',
        httpOnly: true,
        maxAge: config.session.maxAge,
        sameSite: 'lax'
    },
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './database'
    })
}));

// ==================== قاعدة البيانات ====================
const db = require('./backend/db/database');
// سيتم تهيئة الاتصال عند تشغيل الخادم


// ==================== Middleware مخصصة ====================
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📨 [${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// ==================== مستقبِل تقارير CSP (وضع الرصد فقط) ====================
// يُركّب قبل apiLimiter لأن المتصفح قد يرسل مئات التقارير دفعة واحدة فتُستهلك
// حصة الـ rate limit وتضيع البيانات. لا يقرأ ولا يكتب أي بيانات مكتب، لذا فهو
// خارج قاعدة "كل مسار /api لبيانات المكاتب يجب أن يكون خلف requireAuth".
// المسار موجود فقط في وضع report-only ويختفي تمامًا عند التطبيق الفعلي.
if (CSP_MODE === 'report-only') {
    const cspReportLog = process.env.CSP_REPORT_LOG;

    app.post('/api/csp-report',
        express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '256kb' }),
        (req, res) => {
            // report-uri يرسل {"csp-report": {...}}، أما Reporting API فيرسل مصفوفة
            const body = req.body || {};
            const reports = Array.isArray(body) ? body : [body['csp-report'] || body];

            for (const r of reports) {
                if (!r) continue;
                const entry = {
                    directive: r['effective-directive'] || r['violated-directive'] || r.effectiveDirective,
                    blocked: r['blocked-uri'] || r.blockedURL,
                    document: r['document-uri'] || r.documentURL,
                    line: r['line-number'] || r.lineNumber,
                    sample: r['script-sample'] || r.sample
                };
                console.log(`🛡️  [CSP] ${JSON.stringify(entry)}`);
                if (cspReportLog) {
                    fs.appendFileSync(cspReportLog, JSON.stringify(entry) + '\n');
                }
            }

            res.status(204).end();
        }
    );
}

// ==================== Routes API ====================
const { apiLimiter } = require('./backend/middleware/rateLimiter');
app.use('/api', apiLimiter);

app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/system', require('./backend/routes/system'));
app.use('/api/dashboard', require('./backend/routes/dashboard'));
app.use('/api/cases', require('./backend/routes/cases'));
app.use('/api/clients', require('./backend/routes/clients'));
app.use('/api/sessions', require('./backend/routes/sessions'));
app.use('/api/documents', require('./backend/routes/documents'));
app.use('/api/users', require('./backend/routes/users'));
app.use('/api/reports', require('./backend/routes/reports'));
app.use('/api/finance', require('./backend/routes/finance'));
app.use('/api/tasks', require('./backend/routes/tasks'));
app.use('/api/settings', require('./backend/routes/settings'));
app.use('/api/team', require('./backend/routes/team'));
app.use('/api/offices', require('./backend/routes/offices'));
app.use('/api/exports', require('./backend/routes/exports'));
app.use('/api/calendar', require('./backend/routes/calendar'));

// ==================== Routes الصفحات (SPA Support) ====================
const pages = ['/login', '/register', '/dashboard', '/cases', '/clients', '/documents', '/sessions', '/financial', '/reports', '/tasks', '/portal', '/settings', '/team', '/calendar'];

pages.forEach(route => {
    app.get(route, (req, res) => {
        let page = route === '/' ? 'index.html' : `${route.substring(1)}.html`;
        const filePath = path.join(__dirname, 'frontend/public', page);

        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).sendFile(path.join(__dirname, 'frontend/public', 'login.html'));
        }
    });
});

// معالجة باقي المسارات (Wildcard)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/public', 'login.html'));
});

// ==================== معالجة الأخطاء ====================
app.use(require('./backend/middleware/errorHandler'));

// ==================== تشغيل الخادم ====================
async function startServer() {
    try {
        console.log('🚀 بدء تشغيل النظام...');


        // تهيئة الاتصال بقاعدة البيانات
        await db.init();
        const isDbConnected = await db.healthCheck().catch(() => false);

        if (isDbConnected) {

            console.log('✅ قاعدة البيانات متصلة وجاهزة');

            // تهيئة المهام المجدولة
            // ملاحظة: تذكيرات الجلسات (7 أيام / 3 أيام / 24 ساعة / ساعتين) وتنبيهات
            // المهام المتأخرة كلها تُدار من NotificationService عبر cronService،
            // وهي المصدر الوحيد لإرسال التذكيرات والإيميلات.
            const cronService = require('./backend/services/cronService');
            cronService.init();

            // تشغيل فحص أولي عند البدء (للتجربة)
            // cronService.runManualCheck(); 

        } else {
            console.warn('⚠️ تحذير: لم يتم التحقق من اتصال قاعدة البيانات، قد تكون هناك مشكلة');
        }

        app.listen(PORT, () => {
            console.log('🚀 ==================================');
            console.log(`🚀 ${config.app.name}`);
            console.log('🚀 ==================================');
            console.log(`📍 الخادم: http://localhost:${PORT}`);
            console.log('⚖️  النظام جاهز للاستخدام!');
            console.log('🚀 ==================================');
        });

    } catch (error) {
        console.error('❌ فشل في تشغيل الخادم:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;