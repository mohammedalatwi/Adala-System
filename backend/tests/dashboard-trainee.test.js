const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-dash-trainee-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const admin = {
    full_name: 'أدمن تجريبي',
    username: 'dash_admin',
    email: 'dash_admin@example.com',
    password: 'password123',
    phone: '0500000010'
};

let adminAgent;
let lawyerId, traineeId, clientId, caseId;

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

    const lawyerRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامي القضية', username: 'dash_lawyer', email: 'dash_lawyer@example.com', password: 'password123', role: 'lawyer' });
    lawyerId = lawyerRes.body.data.id;

    const traineeRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'متدرب القضية', username: 'dash_trainee', email: 'dash_trainee@example.com', password: 'password123', role: 'trainee' });
    traineeId = traineeRes.body.data.id;
    // إسقاط علم إجبار تغيير كلمة المرور حتى لا يحظر requireNoPendingPasswordChange
    // كل مسارات /api للمتدرب قبل تسجيل دخوله في الاختبار أدناه (نفس نمط team-management.test.js)
    await db.run('UPDATE users SET must_change_password = 0 WHERE id = ?', [traineeId]);

    const clientRes = await adminAgent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل القضية', phone: '0522222223' });
    clientId = clientRes.body.data.id;

    // قضية مُسندة لمحامٍ (lawyer_id) ومتدرب مساعد (assistant_lawyer_id) معًا
    const caseRes = await adminAgent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({
            case_number: 'CASE-DASH-1',
            title: 'قضية تجريبية للوحة تحكم المتدرب',
            case_type: 'مدني',
            client_id: clientId,
            lawyer_id: lawyerId,
            assistant_lawyer_id: traineeId
        });
    caseId = caseRes.body.data.id;

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await adminAgent
        .post('/api/sessions')
        .set('Accept', 'application/json')
        .send({ case_id: caseId, session_date: futureDate, session_type: 'نظر' });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('GET /api/dashboard/data — متدرب مُسند لقضية عبر assistant_lawyer_id', () => {
    let traineeAgent;

    beforeAll(async () => {
        traineeAgent = request.agent(app);
        await traineeAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'dash_trainee@example.com', password: 'password123' });
    });

    test('تعرض القضية المُسندة ضمن الإحصائيات وأحدث القضايا والجلسات القادمة', async () => {
        const res = await traineeAgent
            .get('/api/dashboard/data')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        expect(res.body.data.stats.total_cases).toBe(1);
        expect(res.body.data.stats.upcoming_sessions).toBe(1);

        const recentCaseIds = res.body.data.recentCases.map(c => c.id);
        expect(recentCaseIds).toContain(caseId);

        const upcomingSessionCaseIds = res.body.data.upcomingSessions.map(s => s.case_id);
        expect(upcomingSessionCaseIds).toContain(caseId);
    });
});

describe('GET /api/cases/:id — متدرب مُسند للقضية عبر assistant_lawyer_id', () => {
    let traineeAgent;

    beforeAll(async () => {
        traineeAgent = request.agent(app);
        await traineeAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'dash_trainee@example.com', password: 'password123' });
    });

    test('يسمح للمتدرب المُسند بفتح تفاصيل القضية', async () => {
        const res = await traineeAgent
            .get(`/api/cases/${caseId}`)
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(caseId);
    });
});

describe('GET /api/team/trainees', () => {
    test('يعيد المتدربين النشطين في المكتب لإسنادهم للقضايا', async () => {
        const res = await adminAgent
            .get('/api/team/trainees')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const ids = res.body.data.map(t => t.id);
        expect(ids).toContain(traineeId);
    });
});
