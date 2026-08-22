const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-reports-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const owner = {
    full_name: 'مالك مكتب التقارير',
    username: 'cases_report_owner',
    email: 'cases_report_owner@example.com',
    password: 'password123',
    phone: '0511770001'
};

let agent;

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    agent = request.agent(app);
    await agent.post('/api/auth/register').set('Accept', 'application/json').send(owner);
    await agent.post('/api/auth/login').set('Accept', 'application/json').send({ email: owner.email, password: owner.password });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('GET /api/reports/cases', () => {
    // generateCasesStats كانت تُشغِّل `FROM cases` بلا الاسم المستعار c، بينما
    // whereClause الممرَّر إليها من generateCasesReport مبني على `c.is_active`/
    // `c.office_id` (من الاستعلام الآخر الذي يستخدم `FROM cases c`) — فيفشل
    // بخطأ SQLite خام "no such column: c.is_active" عند أي استدعاء لهذا المسار،
    // بلا استثناء (حتى لمالك المكتب). لم يكن هناك اختبار يُشغّل هذا المسار فعليًا.
    test('returns 200 with case stats instead of a raw SQLite "no such column: c.is_active" error', async () => {
        const res = await agent.get('/api/reports/cases').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.stats).toBeDefined();
        expect(res.body.data.stats.total_cases).toBe(0);
        expect(res.body.data.cases).toEqual([]);
    });
});
