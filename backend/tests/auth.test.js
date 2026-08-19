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
