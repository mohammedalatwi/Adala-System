const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-auth-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const testUser = {
    full_name: 'محامي تجريبي',
    username: 'test_lawyer',
    email: 'test_lawyer@example.com',
    password: 'password123',
    phone: '0500000000'
};

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('Auth flow', () => {
    test('POST /api/auth/register creates an office and an admin user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .set('Accept', 'application/json')
            .send(testUser);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.userId).toBeDefined();
        expect(res.body.data.officeId).toBeDefined();
    });

    test('GET /api/auth/status reports unauthenticated before login', async () => {
        const res = await request(app)
            .get('/api/auth/status')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.authenticated).toBe(false);
    });

    test('POST /api/auth/login rejects wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: testUser.email, password: 'wrong-password' });

        expect(res.body.success).toBe(false);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('POST /api/auth/login succeeds and starts a session', async () => {
        const agent = request.agent(app);

        const loginRes = await agent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: testUser.email, password: testUser.password });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.success).toBe(true);
        expect(loginRes.body.data.user.email).toBe(testUser.email);

        const statusRes = await agent
            .get('/api/auth/status')
            .set('Accept', 'application/json');

        expect(statusRes.body.authenticated).toBe(true);

        const logoutRes = await agent
            .post('/api/auth/logout')
            .set('Accept', 'application/json');

        expect(logoutRes.body.success).toBe(true);

        const statusAfterLogout = await agent
            .get('/api/auth/status')
            .set('Accept', 'application/json');

        expect(statusAfterLogout.body.authenticated).toBe(false);
    });

    test('login as a client-role user populates session.clientId', async () => {
        const passwordHash = await bcrypt.hash('password123', 10);

        const officeResult = await db.run('INSERT INTO offices (name) VALUES (?)', ['مكتب اختبار العميل']);
        const clientResult = await db.run(
            'INSERT INTO clients (full_name, phone, office_id) VALUES (?, ?, ?)',
            ['عميل بوابة تجريبي', '0533333333', officeResult.id]
        );
        await db.run(
            `INSERT INTO users (full_name, username, email, password_hash, role, client_id, office_id)
             VALUES (?, ?, ?, ?, 'client', ?, ?)`,
            ['عميل تجريبي', 'test_portal_client', 'portal_client@example.com', passwordHash, clientResult.id, officeResult.id]
        );

        const agent = request.agent(app);
        const loginRes = await agent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'portal_client@example.com', password: 'password123' });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.user.client_id).toBe(clientResult.id);

        // قبل الإصلاح: req.session.clientId يبقى undefined دائمًا (لم يكن يُضبط بـ login)،
        // فيرفض caseController.js الطلب بخطأ "غير مصرح للعميل بالوصول" (403) حتى لبيانات
        // العميل نفسه. هذا الاختبار يتحقق من أن الجلسة تحمل قيمة clientId الصحيحة فعليًا،
        // وليس فقط أن قيمتها موجودة باستجابة تسجيل الدخول.
        const casesRes = await agent
            .get('/api/cases')
            .set('Accept', 'application/json');

        expect(casesRes.status).toBe(200);
        expect(casesRes.body.success).toBe(true);
    });
});

describe('POST /api/auth/register — concurrent registrations', () => {
    // backend/db/database.js يستخدم اتصال sqlite3 واحد مشترك للتطبيق كله (لا connection
    // pool)، وAuthService.register يفتح BEGIN/COMMIT حوله. قبل إضافة db.transaction()
    // (الطابور التسلسلي)، تحققنا يدويًا أن تسجيلين متزامنين لمستخدمين لا علاقة بينهما
    // إطلاقًا (لا مكتب مشترك، لا صف مشترك) يتصادمان: أحدهما ينجح والآخر يفشل بخطأ SQL
    // خام "cannot start a transaction within a transaction" — أي عطل بنيوي بالاتصال
    // الواحد، لا تنازع على بيانات. هذا الاختبار يثبّت أن db.transaction() يحل ذلك: كلا
    // التسجيلين ينجحان، ولا بيانات مفقودة أو متداخلة بين المكتبين.
    test('two unrelated users registering at the same time both succeed with distinct offices', async () => {
        const userA = { full_name: 'مستخدم تزامن أول', username: 'race_reg_a', email: 'race_reg_a@example.com', password: 'password123', phone: '0599990001' };
        const userB = { full_name: 'مستخدم تزامن ثانٍ', username: 'race_reg_b', email: 'race_reg_b@example.com', password: 'password123', phone: '0599990002' };

        const [resA, resB] = await Promise.all([
            request(app).post('/api/auth/register').set('Accept', 'application/json').send(userA),
            request(app).post('/api/auth/register').set('Accept', 'application/json').send(userB)
        ]);

        expect(resA.status).toBe(201);
        expect(resB.status).toBe(201);
        expect(resA.body.data.officeId).not.toBe(resB.body.data.officeId);
        expect(resA.body.data.userId).not.toBe(resB.body.data.userId);

        const rowA = await db.get('SELECT office_id FROM users WHERE username = ?', ['race_reg_a']);
        const rowB = await db.get('SELECT office_id FROM users WHERE username = ?', ['race_reg_b']);
        expect(rowA.office_id).toBe(resA.body.data.officeId);
        expect(rowB.office_id).toBe(resB.body.data.officeId);
    });
});

describe('PUT /api/auth/password', () => {
    let pwdUser;
    let agent;

    // تسجيل دخول واحد يُعاد استخدامه في كل اختبارات هذا الوصف، بدل تسجيل دخول
    // منفصل بكل اختبار، لتفادي تجاوز الحد الأقصى لـ authLimiter (5 محاولات/15 دقيقة
    // لكل IP) المشترك مع طلبات POST /api/auth/login وPOST /api/auth/register
    // الأخرى بنفس ملف الاختبار.
    beforeAll(async () => {
        const passwordHash = await bcrypt.hash('originalPass1', 10);
        const officeResult = await db.run('INSERT INTO offices (name) VALUES (?)', ['مكتب اختبار كلمة المرور']);
        const userResult = await db.run(
            `INSERT INTO users (full_name, username, email, password_hash, role, must_change_password, office_id)
             VALUES (?, ?, ?, ?, 'lawyer', 1, ?)`,
            ['محامي اختبار كلمة المرور', 'pwd_test_lawyer', 'pwd_test_lawyer@example.com', passwordHash, officeResult.id]
        );
        pwdUser = { id: userResult.id, email: 'pwd_test_lawyer@example.com' };

        agent = request.agent(app);
        await agent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: pwdUser.email, password: 'originalPass1' });
    });

    test('rejects change when current_password is wrong', async () => {
        const res = await agent
            .put('/api/auth/password')
            .set('Accept', 'application/json')
            .send({ current_password: 'wrong-password', new_password: 'newPass456', confirm_password: 'newPass456' });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(401);
    });

    test('rejects new_password shorter than the minimum length', async () => {
        const res = await agent
            .put('/api/auth/password')
            .set('Accept', 'application/json')
            .send({ current_password: 'originalPass1', new_password: '123', confirm_password: '123' });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(400);
    });

    test('changes the password and clears must_change_password', async () => {
        const res = await agent
            .put('/api/auth/password')
            .set('Accept', 'application/json')
            .send({ current_password: 'originalPass1', new_password: 'newPass456', confirm_password: 'newPass456' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updatedUser = await db.get('SELECT password_hash, must_change_password FROM users WHERE id = ?', [pwdUser.id]);
        expect(updatedUser.must_change_password).toBe(0);

        const newPasswordMatches = await bcrypt.compare('newPass456', updatedUser.password_hash);
        expect(newPasswordMatches).toBe(true);
    });
});
