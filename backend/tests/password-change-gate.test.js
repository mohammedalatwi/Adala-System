const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-pwd-gate-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const admin = {
    full_name: 'أدمن اختبار الحظر',
    username: 'gate_test_admin',
    email: 'gate_test_admin@example.com',
    password: 'password123',
    phone: '0500000003'
};

// كلمة السر المؤقتة التي يختارها الأدمن نيابةً عن المحامي عند إنشاء حسابه،
// وهي سبب ضبط must_change_password = 1 تلقائيًا بـ UserService.createUser
const lawyerTempPassword = 'tempPass123';
const lawyer = {
    full_name: 'محامي بكلمة سر مؤقتة',
    username: 'gate_test_lawyer',
    email: 'gate_test_lawyer@example.com',
    password: lawyerTempPassword,
    role: 'lawyer'
};

let adminAgent;
let lawyerAgent;
let lawyerLoginResponse;

// تسجيل الدخول محدود بـ 5 محاولات/15 دقيقة لكل IP (authLimiter)، لذا تُنشأ كل
// الجلسات هنا مرة واحدة ويُعاد استخدامها، وتُبدَّل قيمة must_change_password
// مباشرةً بقاعدة البيانات عند الحاجة بدل إعادة تسجيل الدخول.
beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    adminAgent = request.agent(app);
    await adminAgent
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(admin);
    await adminAgent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: admin.email, password: admin.password });

    await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send(lawyer);

    lawyerAgent = request.agent(app);
    lawyerLoginResponse = await lawyerAgent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: lawyer.email, password: lawyerTempPassword });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('must_change_password gate', () => {
    test('login response exposes must_change_password so the frontend can redirect', async () => {
        expect(lawyerLoginResponse.status).toBe(200);
        expect(lawyerLoginResponse.body.data.user.must_change_password).toBe(1);
    });

    test('GET /api/auth/status stays reachable while blocked and reports the flag', async () => {
        const res = await lawyerAgent
            .get('/api/auth/status')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.authenticated).toBe(true);
        expect(res.body.user.must_change_password).toBe(1);
    });

    test('blocks an unrelated API route with 403 and a clear reason', async () => {
        const res = await lawyerAgent
            .get('/api/cases')
            .set('Accept', 'application/json');

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('يجب تغيير كلمة المرور المؤقتة قبل المتابعة');
        expect(res.body.must_change_password).toBe(true);
    });

    test('blocks write routes too, not just reads', async () => {
        const res = await lawyerAgent
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'موكل يجب ألا يُنشأ', phone: '0555555555' });

        expect(res.status).toBe(403);
        expect(res.body.must_change_password).toBe(true);

        const created = await db.get('SELECT id FROM clients WHERE phone = ?', ['0555555555']);
        expect(created).toBeUndefined();
    });

    test('blocks the self-service profile routes from Commit #2 as well', async () => {
        const res = await lawyerAgent
            .get('/api/users/me')
            .set('Accept', 'application/json');

        expect(res.status).toBe(403);
        expect(res.body.must_change_password).toBe(true);
    });

    test('applies to an admin too — no role-based exemption', async () => {
        // الأدمن غير محظور قبل ضبط العَلَم
        const before = await adminAgent
            .get('/api/cases')
            .set('Accept', 'application/json');
        expect(before.status).toBe(200);

        await db.run('UPDATE users SET must_change_password = 1 WHERE email = ?', [admin.email]);

        const blocked = await adminAgent
            .get('/api/cases')
            .set('Accept', 'application/json');
        expect(blocked.status).toBe(403);
        expect(blocked.body.must_change_password).toBe(true);

        // العَلَم يُقرأ من قاعدة البيانات بكل طلب لا من الجلسة: الحظر بدأ يسري على
        // جلسة الأدمن المفتوحة أصلًا دون إعادة تسجيل دخول، والعكس صحيح بعد التصفير.
        await db.run('UPDATE users SET must_change_password = 0 WHERE email = ?', [admin.email]);

        const after = await adminAgent
            .get('/api/cases')
            .set('Accept', 'application/json');
        expect(after.status).toBe(200);
    });

    test('full flow: blocked → change password → unblocked', async () => {
        const blocked = await lawyerAgent
            .get('/api/cases')
            .set('Accept', 'application/json');
        expect(blocked.status).toBe(403);

        const changeRes = await lawyerAgent
            .put('/api/auth/password')
            .set('Accept', 'application/json')
            .send({
                current_password: lawyerTempPassword,
                new_password: 'permanentPass456',
                confirm_password: 'permanentPass456'
            });
        expect(changeRes.status).toBe(200);
        expect(changeRes.body.success).toBe(true);

        const updated = await db.get('SELECT must_change_password FROM users WHERE email = ?', [lawyer.email]);
        expect(updated.must_change_password).toBe(0);

        const unblocked = await lawyerAgent
            .get('/api/cases')
            .set('Accept', 'application/json');
        expect(unblocked.status).toBe(200);
        expect(unblocked.body.success).toBe(true);
    });

    test('POST /api/auth/logout stays reachable while blocked', async () => {
        await db.run('UPDATE users SET must_change_password = 1 WHERE email = ?', [lawyer.email]);

        const res = await lawyerAgent
            .post('/api/auth/logout')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
