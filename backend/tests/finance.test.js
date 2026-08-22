const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-finance-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const owner = {
    full_name: 'مالكة مكتب المالية',
    username: 'finance_owner',
    email: 'finance_owner@example.com',
    password: 'password123',
    phone: '0511110001'
};

const owner2 = {
    full_name: 'مالك مكتب آخر',
    username: 'finance_owner2',
    email: 'finance_owner2@example.com',
    password: 'password123',
    phone: '0511110002'
};

let agent, agent2, lawyerAgent, traineeAgent, portalAgent;
let officeId, officeId2;
let clientId, otherClientId;
let caseId, otherLawyerCaseId;
let lawyerId, otherLawyerId;
let invoiceA, invoiceB;

// حسابات الفريق (محامٍ/متدرب/بوابة عميل) تُنشأ عبر POST /api/team/members بـ
// must_change_password=1 (UserService.createUser)، وهذا يحظر كل مسارات الـAPI
// عدا auth/status وauth/password وauth/logout حتى يُغيَّر — نفس النمط المستخدم
// في password-change-gate.test.js: نُصفّر العلَم مباشرة بقاعدة البيانات بدل
// المرور بتدفق تغيير كلمة السر الفعلي، لأن هذا الملف لا يختبر تلك الشاشة.
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

    // --- مكتب أول (الأساسي) ---
    agent = request.agent(app);
    const registerRes = await agent
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(owner);
    officeId = registerRes.body.data.officeId;

    await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: owner.email, password: owner.password });

    // --- مكتب ثانٍ (لاختبارات عزل المكاتب) ---
    agent2 = request.agent(app);
    const registerRes2 = await agent2
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(owner2);
    officeId2 = registerRes2.body.data.officeId;

    await agent2
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: owner2.email, password: owner2.password });

    // --- عملاء وقضايا بمكتب 1 ---
    const clientRes = await agent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل الفواتير', phone: '0522220001', email: 'finance_client@example.com' });
    clientId = clientRes.body.data.id;

    const otherClientRes = await agent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل آخر بلا بوابة', phone: '0522220002' });
    otherClientId = otherClientRes.body.data.id;

    // محامٍ يُنشئ له مالك المكتب قضية ويُنشئ عليها فاتورة (لاختبار أنه يرى فواتير قضيته)
    const lawyerRes = await agent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامٍ أول', username: 'finance_lawyer1', email: 'finance_lawyer1@example.com', password: 'password123', role: 'lawyer' });
    lawyerId = lawyerRes.body.data.id;
    await clearMustChangePassword('finance_lawyer1@example.com');
    lawyerAgent = await loginAgent('finance_lawyer1@example.com', 'password123');

    // محامٍ ثانٍ بقضية وفاتورة منفصلتين، فقط لتعبئة lawyer_id — لا يحتاج جلسة دخول خاصة به
    const otherLawyerRes = await agent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامٍ ثانٍ', username: 'finance_lawyer2', email: 'finance_lawyer2@example.com', password: 'password123', role: 'lawyer' });
    otherLawyerId = otherLawyerRes.body.data.id;

    // متدرب (لا يرى أي فاتورة مهما كانت)
    await agent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'متدرب المالية', username: 'finance_trainee', email: 'finance_trainee@example.com', password: 'password123', role: 'trainee' });
    await clearMustChangePassword('finance_trainee@example.com');
    traineeAgent = await loginAgent('finance_trainee@example.com', 'password123');

    // حساب بوابة عميل مرتبط بـclientId (لاختبار أنه يرى فواتيره فقط)
    await agent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل بوابة المالية', username: 'finance_portal', email: 'finance_portal@example.com', password: 'password123', role: 'client', client_id: clientId });
    await clearMustChangePassword('finance_portal@example.com');
    portalAgent = await loginAgent('finance_portal@example.com', 'password123');

    const caseRes = await agent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({ case_number: 'FIN-CASE-001', title: 'قضية العميل الأول', case_type: 'مدني', client_id: clientId, lawyer_id: lawyerId });
    caseId = caseRes.body.data.id;

    const otherCaseRes = await agent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({ case_number: 'FIN-CASE-002', title: 'قضية العميل الآخر', case_type: 'مدني', client_id: otherClientId, lawyer_id: otherLawyerId });
    otherLawyerCaseId = otherCaseRes.body.data.id;
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('POST /api/finance/invoices', () => {
    test('rejects an unauthenticated request', async () => {
        const res = await request(app)
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-01-01', items: [{ description: 'بند', quantity: 1, unit_price: 100 }] });

        expect(res.status).toBe(401);
    });

    test('creates an invoice with a single item and computes the total', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({
                client_id: clientId,
                case_id: caseId,
                issue_date: '2026-01-01',
                due_date: '2026-02-01',
                items: [{ description: 'أتعاب استشارة', quantity: 1, unit_price: 500 }]
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.amount).toBe(500);
        invoiceA = res.body.data.id;

        const stored = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceA]);
        expect(stored.office_id).toBe(officeId);
        expect(stored.paid_amount).toBe(0);
        expect(stored.status).toBe('unpaid');
    });

    test('creates an invoice with multiple items and sums the total correctly', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({
                client_id: otherClientId,
                case_id: otherLawyerCaseId,
                issue_date: '2026-01-05',
                items: [
                    { description: 'بند أول', quantity: 2, unit_price: 150 },
                    { description: 'بند ثانٍ', quantity: 3, unit_price: 40.5 }
                ]
            });

        expect(res.status).toBe(201);
        // 2*150 + 3*40.5 = 300 + 121.5 = 421.5
        expect(res.body.data.amount).toBe(421.5);
        invoiceB = res.body.data.id;

        const items = await db.all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceB]);
        expect(items).toHaveLength(2);
        expect(items.map(i => i.total).sort()).toEqual([121.5, 300]);
    });

    test('creates an invoice without a case_id (optional field)', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({
                client_id: clientId,
                issue_date: '2026-01-10',
                items: [{ description: 'بند بلا قضية', quantity: 1, unit_price: 200 }]
            });

        expect(res.status).toBe(201);
        const stored = await db.get('SELECT case_id FROM invoices WHERE id = ?', [res.body.data.id]);
        expect(stored.case_id).toBeNull();
    });

    test('rejects an empty items array', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-01-01', items: [] });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('rejects a missing items field', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-01-01' });

        expect(res.status).toBe(400);
    });

    test('rejects an item with zero quantity', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-01-01', items: [{ description: 'بند', quantity: 0, unit_price: 100 }] });

        expect(res.status).toBe(400);
    });

    test('rejects an item with a negative unit_price', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-01-01', items: [{ description: 'بند', quantity: 1, unit_price: -10 }] });

        expect(res.status).toBe(400);
    });

    test('rejects a missing client_id', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ issue_date: '2026-01-01', items: [{ description: 'بند', quantity: 1, unit_price: 100 }] });

        expect(res.status).toBe(400);
    });

    test('rejects a missing issue_date', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, items: [{ description: 'بند', quantity: 1, unit_price: 100 }] });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/finance/invoices', () => {
    test('office owner (admin) sees invoices created in their own office', async () => {
        const res = await agent.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(i => i.id);
        expect(ids).toEqual(expect.arrayContaining([invoiceA, invoiceB]));
    });

    test('office isolation: a second office never sees the first office invoices', async () => {
        const res = await agent2.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(i => i.id);
        expect(ids).not.toContain(invoiceA);
        expect(ids).not.toContain(invoiceB);
    });

    test('filters by client_id', async () => {
        const res = await agent.get(`/api/finance/invoices?client_id=${otherClientId}`).set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data.every(i => i.client_id === otherClientId)).toBe(true);
        expect(res.body.data.map(i => i.id)).toContain(invoiceB);
    });

    test('filters by status', async () => {
        const res = await agent.get('/api/finance/invoices?status=unpaid').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data.every(i => i.status === 'unpaid')).toBe(true);
    });

    test('lawyer role sees invoices tied to their own case', async () => {
        const res = await lawyerAgent.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(i => i.id);
        expect(ids).toContain(invoiceA);
    });

    test('lawyer role does not see invoices tied to another lawyer\'s case', async () => {
        const res = await lawyerAgent.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(i => i.id);
        expect(ids).not.toContain(invoiceB);
    });

    test('trainee role sees no invoices at all', async () => {
        const res = await traineeAgent.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });

    test('client portal role sees only its own invoices', async () => {
        const res = await portalAgent.get('/api/finance/invoices').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(i => i.id);
        expect(ids).toContain(invoiceA);
        expect(ids).not.toContain(invoiceB);
    });
});
