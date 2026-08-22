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

describe('POST /api/finance/expenses', () => {
    test('rejects an unauthenticated request', async () => {
        const res = await request(app)
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف', amount: 100, expense_date: '2026-03-01' });

        expect(res.status).toBe(401);
    });

    test('creates an expense without a case_id (optional field)', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف عام', amount: 75.5, expense_date: '2026-03-01', category: 'إدارية' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const stored = await db.get('SELECT * FROM expenses WHERE id = ?', [res.body.data.id]);
        expect(stored.office_id).toBe(officeId);
        expect(stored.case_id).toBeNull();
        expect(stored.amount).toBe(75.5);
        expect(stored.is_billable).toBe(0);
    });

    test('creates an expense linked to a case with is_billable set', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ case_id: caseId, title: 'مصروف انتقال', amount: 120, expense_date: '2026-03-02', is_billable: true });

        expect(res.status).toBe(201);

        const stored = await db.get('SELECT * FROM expenses WHERE id = ?', [res.body.data.id]);
        expect(stored.case_id).toBe(caseId);
        expect(stored.is_billable).toBe(1);
    });

    test('rejects a missing title', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ amount: 100, expense_date: '2026-03-01' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('rejects an amount of 0', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف', amount: 0, expense_date: '2026-03-01' });

        expect(res.status).toBe(400);
    });

    test('rejects a negative amount', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف', amount: -20, expense_date: '2026-03-01' });

        expect(res.status).toBe(400);
    });

    test('rejects a missing expense_date', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف', amount: 100 });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/finance/expenses', () => {
    let expenseOwnCase, expenseOtherLawyerCase, expenseNoCase, expenseOffice2;

    beforeAll(async () => {
        const r1 = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ case_id: caseId, title: 'مصروف قضية العميل الأول', amount: 60, expense_date: '2026-03-05' });
        expenseOwnCase = r1.body.data.id;

        const r2 = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ case_id: otherLawyerCaseId, title: 'مصروف قضية أخرى', amount: 40, expense_date: '2026-03-05' });
        expenseOtherLawyerCase = r2.body.data.id;

        const r3 = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف عام بلا قضية', amount: 25, expense_date: '2026-03-05' });
        expenseNoCase = r3.body.data.id;

        const r4 = await agent2
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({ title: 'مصروف مكتب آخر', amount: 90, expense_date: '2026-03-05' });
        expenseOffice2 = r4.body.data.id;
    });

    test('office owner (admin) sees expenses created in their own office, including ones without a case', async () => {
        const res = await agent.get('/api/finance/expenses').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(e => e.id);
        expect(ids).toEqual(expect.arrayContaining([expenseOwnCase, expenseOtherLawyerCase, expenseNoCase]));
    });

    test('office isolation: a second office never sees the first office expenses', async () => {
        const res = await agent2.get('/api/finance/expenses').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(e => e.id);
        expect(ids).toContain(expenseOffice2);
        expect(ids).not.toContain(expenseOwnCase);
        expect(ids).not.toContain(expenseOtherLawyerCase);
        expect(ids).not.toContain(expenseNoCase);
    });

    test('lawyer role sees only expenses tied to their own case', async () => {
        const res = await lawyerAgent.get('/api/finance/expenses').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(e => e.id);
        expect(ids).toContain(expenseOwnCase);
        expect(ids).not.toContain(expenseOtherLawyerCase);
        expect(ids).not.toContain(expenseNoCase);
    });

    test('client portal role sees only expenses tied to a case for their own client', async () => {
        const res = await portalAgent.get('/api/finance/expenses').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.map(e => e.id);
        expect(ids).toContain(expenseOwnCase);
        expect(ids).not.toContain(expenseOtherLawyerCase);
        expect(ids).not.toContain(expenseNoCase);
    });

    test('trainee role sees no expenses at all', async () => {
        const res = await traineeAgent.get('/api/finance/expenses').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });
});

describe('FinanceService.createInvoice — concurrent creation and sequential numbering', () => {
    // كانت invoice_number = 'INV-' + Date.now() (راجع تاريخ Git لهذا الملف): إنشاءان
    // بنفس المللي ثانية يتصادمان على قيد UNIQUE، والثاني يُفقد بخطأ SQL خام — خلل
    // اكتُشف أثناء التحقق من إصلاح طابور transaction() (كان انهيار BEGIN المتداخلة
    // يحدث أولًا ويُخفيه). الإصلاح: رقم تسلسلي مقروء لكل مكتب ولكل سنة
    // (INV-{سنة}-{4 خانات})، محسوب من MAX(sequence_number)+1 لنفس (office_id, السنة)
    // داخل نفس db.transaction() المحمية بالطابور — فلا حاجة بعد الآن للتحكم بـ
    // Date.now() لجعل الاختبار حتميًا؛ التسلسل نفسه حتمي الآن تحت التزامن الحقيقي.
    let ownerId;

    beforeAll(async () => {
        const row = await db.get('SELECT id FROM users WHERE email = ?', ['finance_owner@example.com']);
        ownerId = row.id;
    });

    async function currentMaxSequence(forOfficeId, year) {
        const row = await db.get(
            `SELECT MAX(sequence_number) as maxSeq FROM invoices WHERE office_id = ? AND strftime('%Y', issue_date) = ?`,
            [forOfficeId, year]
        );
        return row.maxSeq || 0;
    }

    test('two concurrent creations for the same office get distinct, correctly formatted, consecutive invoice numbers', async () => {
        const startSeq = await currentMaxSequence(officeId, '2026');

        const [r1, r2] = await Promise.all([
            FinanceService.createInvoice({ client_id: clientId, issue_date: '2026-02-07', items: [{ description: 'بند أول', quantity: 1, unit_price: 111 }] }, ownerId, officeId),
            FinanceService.createInvoice({ client_id: clientId, issue_date: '2026-02-07', items: [{ description: 'بند ثانٍ', quantity: 1, unit_price: 222 }] }, ownerId, officeId)
        ]);

        expect(r1.id).not.toBe(r2.id);
        expect(r1.invoice_number).not.toBe(r2.invoice_number);
        expect(r1.invoice_number).toMatch(/^INV-2026-\d{4}$/);
        expect(r2.invoice_number).toMatch(/^INV-2026-\d{4}$/);

        const rows = await db.all('SELECT sequence_number FROM invoices WHERE id IN (?, ?) ORDER BY sequence_number', [r1.id, r2.id]);
        expect(rows.map(r => r.sequence_number)).toEqual([startSeq + 1, startSeq + 2]);

        const items1 = await db.all('SELECT unit_price FROM invoice_items WHERE invoice_id = ?', [r1.id]);
        const items2 = await db.all('SELECT unit_price FROM invoice_items WHERE invoice_id = ?', [r2.id]);
        expect(items1).toHaveLength(1);
        expect(items2).toHaveLength(1);
    });

    test('five concurrent creations for the same office all succeed with a complete, gap-free, non-duplicated sequence', async () => {
        const startSeq = await currentMaxSequence(officeId, '2026');

        const make = () => FinanceService.createInvoice(
            { client_id: clientId, issue_date: '2026-02-08', items: [{ description: 'بند متعدد', quantity: 1, unit_price: 10 }] },
            ownerId,
            officeId
        );

        const results = await Promise.all([make(), make(), make(), make(), make()]);
        const ids = results.map(r => r.id);
        expect(new Set(ids).size).toBe(5); // لا معرّفات مكررة

        const rows = await db.all(`SELECT sequence_number FROM invoices WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        const seqs = rows.map(r => r.sequence_number).sort((a, b) => a - b);
        expect(seqs).toEqual([startSeq + 1, startSeq + 2, startSeq + 3, startSeq + 4, startSeq + 5]);
    });

    test('numbering is independent per office — concurrent creation in two different offices does not share or skip sequence numbers', async () => {
        const office2ClientRes = await agent2
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل ترقيم مستقل', phone: '0533330099' });
        const office2ClientId = office2ClientRes.body.data.id;
        const owner2Row = await db.get('SELECT id FROM users WHERE email = ?', ['finance_owner2@example.com']);

        const startSeqOffice1 = await currentMaxSequence(officeId, '2026');
        const startSeqOffice2 = await currentMaxSequence(officeId2, '2026');

        const [r1, r2] = await Promise.all([
            FinanceService.createInvoice({ client_id: clientId, issue_date: '2026-02-09', items: [{ description: 'بند مكتب 1', quantity: 1, unit_price: 10 }] }, ownerId, officeId),
            FinanceService.createInvoice({ client_id: office2ClientId, issue_date: '2026-02-09', items: [{ description: 'بند مكتب 2', quantity: 1, unit_price: 10 }] }, owner2Row.id, officeId2)
        ]);

        // كل مكتب يبدأ من الرقم التالي بعد آخر رقم له فقط — لا يستهلك أحدهما رقمًا من الآخر
        expect(r1.invoice_number).toBe(`INV-2026-${String(startSeqOffice1 + 1).padStart(4, '0')}`);
        expect(r2.invoice_number).toBe(`INV-2026-${String(startSeqOffice2 + 1).padStart(4, '0')}`);
    });
});

describe('KNOWN ISSUE: createInvoice/createExpense do not verify that client_id/case_id belong to the caller\'s own office', () => {
    // FinanceService.createInvoice وcreateExpense يُدخلان client_id/case_id من الطلب
    // مباشرة في INSERT دون أي تحقق من أنهما ينتميان لـoffice_id الخاص بالجلسة الحالية
    // (خلافًا لـrecordPayment وdownloadInvoicePDF أدناه، اللذين يشترطان office_id في
    // WHERE فيرفضان أي صف من مكتب آخر). النتيجة: مستخدم بمكتب 1 يستطيع حاليًا ربط
    // فاتورة/مصروف بعميل أو قضية يملكهما مكتب آخر تمامًا. هذه الاختبارات توثّق
    // السلوك الحالي كما هو دون إصلاحه.
    let office2ClientId, office2CaseId;

    beforeAll(async () => {
        const clientRes = await agent2
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل لاختبار عزل الإنشاء', phone: '0544440001' });
        office2ClientId = clientRes.body.data.id;

        const owner2Row = await db.get('SELECT id FROM users WHERE email = ?', ['finance_owner2@example.com']);

        const caseRes = await agent2
            .post('/api/cases')
            .set('Accept', 'application/json')
            .send({ case_number: 'FIN-CASE-OFFICE2-001', title: 'قضية مكتب 2 لاختبار العزل', case_type: 'مدني', client_id: office2ClientId, lawyer_id: owner2Row.id });
        office2CaseId = caseRes.body.data.id;
    });

    test('KNOWN ISSUE: createInvoice accepts a client_id belonging to another office', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({
                client_id: office2ClientId,
                issue_date: '2026-04-01',
                items: [{ description: 'بند بعميل من مكتب آخر', quantity: 1, unit_price: 100 }]
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const stored = await db.get('SELECT client_id, office_id FROM invoices WHERE id = ?', [res.body.data.id]);
        expect(stored.office_id).toBe(officeId);
        expect(stored.client_id).toBe(office2ClientId);
    });

    test('KNOWN ISSUE: createInvoice accepts a case_id belonging to another office', async () => {
        const res = await agent
            .post('/api/finance/invoices')
            .set('Accept', 'application/json')
            .send({
                client_id: clientId,
                case_id: office2CaseId,
                issue_date: '2026-04-01',
                items: [{ description: 'بند بقضية من مكتب آخر', quantity: 1, unit_price: 100 }]
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const stored = await db.get('SELECT case_id, office_id FROM invoices WHERE id = ?', [res.body.data.id]);
        expect(stored.office_id).toBe(officeId);
        expect(stored.case_id).toBe(office2CaseId);
    });

    test('KNOWN ISSUE: createExpense accepts a case_id belonging to another office', async () => {
        const res = await agent
            .post('/api/finance/expenses')
            .set('Accept', 'application/json')
            .send({
                case_id: office2CaseId,
                title: 'مصروف بقضية من مكتب آخر',
                amount: 50,
                expense_date: '2026-04-01'
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);

        const stored = await db.get('SELECT case_id, office_id FROM expenses WHERE id = ?', [res.body.data.id]);
        expect(stored.office_id).toBe(officeId);
        expect(stored.case_id).toBe(office2CaseId);
    });
});

describe('GET /api/finance/invoices/:id/download', () => {
    test('downloads a valid PDF for an existing invoice', async () => {
        const res = await agent
            .get(`/api/finance/invoices/${invoiceA}/download`)
            .buffer(true);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.slice(0, 5).toString('latin1')).toBe('%PDF-');
    });

    test('returns an error for a nonexistent invoice', async () => {
        const res = await agent
            .get('/api/finance/invoices/999999/download')
            .set('Accept', 'application/json');

        // نفس نمط الخطأ الموثّق أعلاه لـrecordPayment: throw new Error('الفاتورة غير
        // موجودة') لا يحوي 'غير مصرح'، فيسقط على 500 الافتراضي في errorHandler.js
        // بدل 404 الصحيح منطقيًا.
        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('الفاتورة غير موجودة');
    });

    test('office isolation: rejects downloading an invoice belonging to another office (unlike the creation paths above, WHERE office_id here actually blocks it)', async () => {
        const res = await agent2
            .get(`/api/finance/invoices/${invoiceA}/download`)
            .set('Accept', 'application/json');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('الفاتورة غير موجودة');
    });
});
