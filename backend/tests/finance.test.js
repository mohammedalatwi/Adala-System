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
const FinanceService = require('../services/FinanceService');

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

describe('POST /api/finance/payments', () => {
    let invoicePartialId, invoiceFullId, invoiceInstallmentsId, invoiceOverpayId, invoiceMethodId;
    let crossOfficeInvoiceId;

    async function createInvoice(amount) {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-02-01', items: [{ description: 'بند دفعة', quantity: 1, unit_price: amount }] });
        return res.body.data.id;
    }

    beforeAll(async () => {
        invoicePartialId = await createInvoice(1000);
        invoiceFullId = await createInvoice(500);
        invoiceInstallmentsId = await createInvoice(100);
        invoiceOverpayId = await createInvoice(200);
        invoiceMethodId = await createInvoice(150);

        // فاتورة بمكتب آخر (office2)، لاختبار أن recordPayment يرفضها كما يرفض فاتورة غير موجودة
        const office2ClientRes = await agent2
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل مكتب آخر', phone: '0533330001' });
        const office2ClientId = office2ClientRes.body.data.id;

        const office2InvoiceRes = await agent2
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: office2ClientId, issue_date: '2026-02-01', items: [{ description: 'بند', quantity: 1, unit_price: 300 }] });
        crossOfficeInvoiceId = office2InvoiceRes.body.data.id;
    });

    test('a partial payment moves the invoice to partially_paid and accumulates paid_amount', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoicePartialId, amount: 400, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.newStatus).toBe('partially_paid');

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [invoicePartialId]);
        expect(invoice.paid_amount).toBe(400);
        expect(invoice.status).toBe('partially_paid');
    });

    test('a payment that completes the amount moves the invoice to paid', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceFullId, amount: 500, payment_date: '2026-02-02', payment_method: 'bank_transfer' });

        expect(res.status).toBe(200);
        expect(res.body.data.newStatus).toBe('paid');

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [invoiceFullId]);
        expect(invoice.paid_amount).toBe(500);
        expect(invoice.status).toBe('paid');
    });

    test('three sequential partial payments (33.33 + 33.33 + 33.34) sum exactly to 100.00 without a floating-point rounding rejection', async () => {
        const first = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceInstallmentsId, amount: 33.33, payment_date: '2026-02-03', payment_method: 'cash' });
        expect(first.status).toBe(200);
        expect(first.body.data.newStatus).toBe('partially_paid');

        const second = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceInstallmentsId, amount: 33.33, payment_date: '2026-02-03', payment_method: 'cash' });
        expect(second.status).toBe(200);
        expect(second.body.data.newStatus).toBe('partially_paid');

        // الدفعة الأخيرة يجب ألا تُرفض بسبب خطأ تقريب (مثل 100.00000000000001 > 100)
        const third = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceInstallmentsId, amount: 33.34, payment_date: '2026-02-03', payment_method: 'cash' });
        expect(third.status).toBe(200);
        expect(third.body.data.newStatus).toBe('paid');

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [invoiceInstallmentsId]);
        expect(invoice.paid_amount).toBe(100);
        expect(invoice.status).toBe('paid');
    });

    test('rejects amount = 0 with 400 before reaching the service', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceOverpayId, amount: 0, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);

        const invoice = await db.get('SELECT paid_amount FROM invoices WHERE id = ?', [invoiceOverpayId]);
        expect(invoice.paid_amount).toBe(0);
    });

    test('rejects a negative amount with 400 before reaching the service', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceOverpayId, amount: -50, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    // --- الحالات التالية توثّق سلوكًا حاليًا غير مثالي (لا تُصلحه هنا، فقط تُثبّته باختبار) ---

    test('KNOWN ISSUE: an unknown invoice_id currently fails with 500, not 404 — FinanceService.recordPayment does `throw new Error(\'الفاتورة غير موجودة\')`, and errorHandler.js only maps messages containing \'غير مصرح\' to 403, so this generic error falls through to the 500 default instead of a proper 404/400', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: 999999, amount: 10, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('الفاتورة غير موجودة');
    });

    test('KNOWN ISSUE: an invoice belonging to another office is rejected the same as an unknown invoice — also 500, not 403/404 — confirms office_id scoping in recordPayment works (cross-office payment is blocked), only the status code is wrong', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: crossOfficeInvoiceId, amount: 10, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('الفاتورة غير موجودة');

        // تأكيد أن الفاتورة بمكتبها الأصلي لم تتأثر إطلاقًا
        const invoice = await db.get('SELECT paid_amount FROM invoices WHERE id = ?', [crossOfficeInvoiceId]);
        expect(invoice.paid_amount).toBe(0);
    });

    test('KNOWN ISSUE: a payment exceeding the remaining balance is rejected but with 500, not 400 — this is an application-level validation (`if (invoice.paid_amount + amount > invoice.amount) throw new Error(...)`), not a server fault, and should be a 400 like the other validation failures above', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceOverpayId, amount: 250, payment_date: '2026-02-02', payment_method: 'cash' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('المبلغ المدفوع يتجاوز قيمة الفاتورة المتبقية');

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [invoiceOverpayId]);
        expect(invoice.paid_amount).toBe(0);
        expect(invoice.status).toBe('unpaid');
    });

    test('KNOWN ISSUE: an out-of-enum payment_method is not caught by validatePayment (it only checks notEmpty, not the payments.payment_method CHECK constraint values) and reaches the database, failing with a raw SQLite constraint error instead of a clean 400', async () => {
        const res = await agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: invoiceMethodId, amount: 10, payment_date: '2026-02-02', payment_method: 'visa' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/CHECK constraint failed/i);

        const invoice = await db.get('SELECT paid_amount FROM invoices WHERE id = ?', [invoiceMethodId]);
        expect(invoice.paid_amount).toBe(0);
    });
});

describe('POST /api/finance/payments — concurrent payments on the same invoice', () => {
    // مبني على db.transaction() (backend/db/database.js): طابور تسلسلي يمنع فتح BEGIN
    // ثانية قبل إغلاق الأولى، مع نقل قراءة paid_amount والتحقق من المتبقي داخل نفس
    // المنطقة المحمية بالطابور (FinanceService.recordPayment). قبل هذا الإصلاح كان
    // الاختبار هنا يوثّق أن أحد الطلبين المتزامنين ينهار برسالة SQL خام (راجع تاريخ
    // Git لهذا الملف) — بعده كلاهما ينجح ويتراكم بشكل صحيح، كما يظهر أدناه.
    test('two concurrent payments that together exactly complete the invoice both succeed and accumulate correctly', async () => {
        const invRes = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-02-05', items: [{ description: 'بند سباق', quantity: 1, unit_price: 1000 }] });
        const raceInvoiceId = invRes.body.data.id;

        const payAttempt = () => agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: raceInvoiceId, amount: 500, payment_date: '2026-02-05', payment_method: 'cash' });

        const [r1, r2] = await Promise.all([payAttempt(), payAttempt()]);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [raceInvoiceId]);
        const paymentRows = await db.all('SELECT amount FROM payments WHERE invoice_id = ?', [raceInvoiceId]);

        // paid_amount يساوي مجموع صفوف payments فعليًا، لا مجرد قيمة نهائية معقولة
        expect(paymentRows).toHaveLength(2);
        const sumOfRows = paymentRows.reduce((s, r) => s + r.amount, 0);
        expect(sumOfRows).toBe(1000);
        expect(invoice.paid_amount).toBe(sumOfRows);
        expect(invoice.status).toBe('paid');
    });

    test('five concurrent payments of 200 each on a 1000 invoice all succeed and sum exactly (no lost or duplicated payment)', async () => {
        const invRes = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-02-05', items: [{ description: 'بند سباق متعدد', quantity: 1, unit_price: 1000 }] });
        const raceInvoiceId = invRes.body.data.id;

        const payAttempt = () => agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: raceInvoiceId, amount: 200, payment_date: '2026-02-05', payment_method: 'cash' });

        const results = await Promise.all([payAttempt(), payAttempt(), payAttempt(), payAttempt(), payAttempt()]);

        expect(results.every(r => r.status === 200)).toBe(true);

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [raceInvoiceId]);
        const paymentRows = await db.all('SELECT amount FROM payments WHERE invoice_id = ?', [raceInvoiceId]);

        expect(paymentRows).toHaveLength(5);
        const sumOfRows = paymentRows.reduce((s, r) => s + r.amount, 0);
        expect(sumOfRows).toBe(1000);
        expect(invoice.paid_amount).toBe(1000);
        expect(invoice.status).toBe('paid');
    });

    test('a payment that would overpay is still correctly rejected as a business-rule violation even when racing a valid concurrent payment — not a raw SQL crash and not silently accepted', async () => {
        // فاتورة بقيمة 500، ومحاولتا دفع 400 متزامنتين (المجموع 800 > 500). المطلوب:
        // واحدة تنجح (400 ضمن حدود الفاتورة)، والأخرى تُرفض برسالة "يتجاوز المتبقي"
        // المعتادة (500 من errorHandler.js لأن هذا throw عادي، كما وثّقنا بـCommit 2) —
        // لا رسالة SQL خام (يعني الطابور يعمل)، ولا نجاح خاطئ لكلتيهما (يعني القراءة
        // انتقلت فعلًا داخل المنطقة المحمية ولا تعتمد على قيمة paid_amount قديمة).
        const invRes = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({ client_id: clientId, issue_date: '2026-02-05', items: [{ description: 'بند سباق تجاوز', quantity: 1, unit_price: 500 }] });
        const raceInvoiceId = invRes.body.data.id;

        const payAttempt = () => agent
            .post('/api/finance/payments')
            .set('Accept', 'application/json')
            .send({ invoice_id: raceInvoiceId, amount: 400, payment_date: '2026-02-05', payment_method: 'cash' });

        const [r1, r2] = await Promise.all([payAttempt(), payAttempt()]);
        const results = [r1, r2];

        const succeeded = results.filter(r => r.status === 200);
        const failed = results.filter(r => r.status !== 200);

        expect(succeeded).toHaveLength(1);
        expect(failed).toHaveLength(1);
        expect(failed[0].status).toBe(500);
        expect(failed[0].body.message).toBe('المبلغ المدفوع يتجاوز قيمة الفاتورة المتبقية');

        const invoice = await db.get('SELECT paid_amount, status FROM invoices WHERE id = ?', [raceInvoiceId]);
        const paymentRows = await db.all('SELECT amount FROM payments WHERE invoice_id = ?', [raceInvoiceId]);

        expect(paymentRows).toHaveLength(1);
        expect(paymentRows[0].amount).toBe(400);
        expect(invoice.paid_amount).toBe(400);
        expect(invoice.status).toBe('partially_paid');
    });
});

describe('FinanceService.createInvoice — concurrent creation', () => {
    // نفس آلية db.transaction() تحمي createInvoice أيضًا (لا مزيد من "cannot start a
    // transaction within a transaction" — تحقّقنا يدويًا 4 مرات متتالية بعد الإصلاح
    // ولم يظهر ذلك الخطأ إطلاقًا بأي منها). لكن أول محاولة لاختبار هذا عبر HTTP
    // بـPromise.all كشفت خللًا حقيقيًا آخر لم يكن ظاهرًا سابقًا (كان الانهيار على
    // BEGIN المتداخلة يحدث أولًا ويُخفيه): invoice_number = 'INV-' + Date.now() غير
    // آمن من التصادم — إنشاءان بنفس المللي ثانية يتصادمان على قيد UNIQUE. لاحظنا هذا
    // فعليًا (تصادم في ~2 من 4 تشغيلات متتالية عبر HTTP، راجع سجل الجلسة)، لا افتراضًا.
    //
    // لعزل إثبات أن طابور transaction() نفسه يعمل بشكل صحيح عن مشكلة invoice_number
    // المنفصلة، الاختباران التاليان يستدعيان FinanceService مباشرة (بتجاوز HTTP) مع
    // التحكم بـDate.now() بشكل حتمي — لا نعتمد على توقيت عشوائي حقيقي قد يتصادم أو لا
    // يتصادم، فيصير الاختبار متذبذبًا (flaky) بلا داعٍ.
    let ownerId;

    beforeAll(async () => {
        const row = await db.get('SELECT id FROM users WHERE email = ?', ['finance_owner@example.com']);
        ownerId = row.id;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('two concurrent creations with distinct invoice_number values both succeed correctly (proves the transaction queue itself is safe)', async () => {
        let call = 0;
        jest.spyOn(Date, 'now').mockImplementation(() => (call++ === 0 ? 5000000000001 : 5000000000002));

        const [r1, r2] = await Promise.all([
            FinanceService.createInvoice({ client_id: clientId, issue_date: '2026-02-07', items: [{ description: 'بند أول', quantity: 1, unit_price: 111 }] }, ownerId, officeId),
            FinanceService.createInvoice({ client_id: clientId, issue_date: '2026-02-07', items: [{ description: 'بند ثانٍ', quantity: 1, unit_price: 222 }] }, ownerId, officeId)
        ]);

        expect(r1.id).not.toBe(r2.id);
        expect(r1.invoice_number).not.toBe(r2.invoice_number);

        const items1 = await db.all('SELECT unit_price FROM invoice_items WHERE invoice_id = ?', [r1.id]);
        const items2 = await db.all('SELECT unit_price FROM invoice_items WHERE invoice_id = ?', [r2.id]);
        expect(items1).toHaveLength(1);
        expect(items2).toHaveLength(1);
        expect(items1[0].unit_price).toBe(111);
        expect(items2[0].unit_price).toBe(222);
    });

    test('NEWLY DISCOVERED KNOWN ISSUE: two invoices created within the exact same millisecond collide on invoice_number and the second is lost with a raw SQL error', async () => {
        jest.spyOn(Date, 'now').mockReturnValue(5000000000099);

        const make = () => FinanceService.createInvoice(
            { client_id: clientId, issue_date: '2026-02-07', items: [{ description: 'بند متصادم', quantity: 1, unit_price: 50 }] },
            ownerId,
            officeId
        );

        const results = await Promise.allSettled([make(), make()]);
        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason.message).toMatch(/UNIQUE constraint failed: invoices\.invoice_number/i);

        // الفاتورة التي نجحت فقط هي الموجودة فعلًا — لا فاتورة "شبح" بلا بنود، ولا بند مكرر
        const invoiceRows = await db.all('SELECT id FROM invoices WHERE invoice_number = ?', ['INV-5000000000099']);
        expect(invoiceRows).toHaveLength(1);
        const items = await db.all('SELECT id FROM invoice_items WHERE invoice_id = ?', [invoiceRows[0].id]);
        expect(items).toHaveLength(1);
    });
});
