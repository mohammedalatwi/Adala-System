const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-reports-access-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const owner = {
    full_name: 'مالكة مكتب التقارير',
    username: 'reports_owner',
    email: 'reports_owner@example.com',
    password: 'password123',
    phone: '0511990001'
};

let adminAgent, portalAgent;
let clientId;

async function clearMustChangePassword(email) {
    await db.run('UPDATE users SET must_change_password = 0 WHERE email = ?', [email]);
}

async function loginAgent(email, password) {
    const a = request.agent(app);
    const res = await a.post('/api/auth/login').set('Accept', 'application/json').send({ email, password });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return a;
}

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/register').set('Accept', 'application/json').send(owner);
    await adminAgent.post('/api/auth/login').set('Accept', 'application/json').send({ email: owner.email, password: owner.password });

    const clientRes = await adminAgent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل بوابة التقارير', phone: '0522990001', email: 'reports_client@example.com' });
    clientId = clientRes.body.data.id;

    await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل بوابة التقارير', username: 'reports_portal', email: 'reports_portal@example.com', password: 'password123', role: 'client', client_id: clientId });
    await clearMustChangePassword('reports_portal@example.com');
    portalAgent = await loginAgent('reports_portal@example.com', 'password123');
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

// كل هذه المسارات كانت مفتوحة بلا أي تقييد دور — أي حساب بوابة عميل (خارجي عن
// المكتب) يستطيع سحب تقارير وإحصائيات المكتب الكاملة (مالية وتشغيلية). الإصلاح
// يحظر role === 'client' تحديدًا (403)، بنفس نمط الفحص المستخدم أصلًا في
// clientController.js لأفعال أخرى محظورة على العميل.
const restrictedRoutes = [
    ['تقرير القضايا', '/api/reports/cases'],
    ['تقرير أداء المحامين', '/api/reports/performance'],
    ['تقرير الجلسات', '/api/reports/sessions'],
    ['التقرير المالي', '/api/reports/financial'],
    ['إحصائيات النظام', '/api/reports/system-stats'],
    ['إحصائيات القضايا', '/api/cases/stats'],
    ['إحصائيات المستندات', '/api/documents/stats'],
    ['إحصائيات الجلسات', '/api/sessions/stats'],
    ['إحصائيات العملاء', '/api/clients/stats']
];

describe('Client-portal accounts are blocked from office-wide reports and stats', () => {
    test.each(restrictedRoutes)('%s: client portal gets 403, not the office data', async (_label, route) => {
        const res = await portalAgent.get(route).set('Accept', 'application/json');

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    test.each(restrictedRoutes)('%s: office owner (admin) still gets the report normally', async (_label, route) => {
        const res = await adminAgent.get(route).set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
