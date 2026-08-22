const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-sessions-upcoming-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const owner = {
    full_name: 'مالك مكتب الجلسات القادمة',
    username: 'upcoming_owner',
    email: 'upcoming_owner@example.com',
    password: 'password123',
    phone: '0511880001'
};

let adminAgent, traineeAgent;
let lawyerId, otherLawyerId, traineeId, clientId;
let caseOwnId, caseOtherId;

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
        .send({ full_name: 'عميل الجلسات القادمة', phone: '0522880001' });
    clientId = clientRes.body.data.id;

    const lawyerRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامٍ أول', username: 'upcoming_lawyer1', email: 'upcoming_lawyer1@example.com', password: 'password123', role: 'lawyer' });
    lawyerId = lawyerRes.body.data.id;

    const otherLawyerRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامٍ ثانٍ', username: 'upcoming_lawyer2', email: 'upcoming_lawyer2@example.com', password: 'password123', role: 'lawyer' });
    otherLawyerId = otherLawyerRes.body.data.id;

    const traineeRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'متدرب الجلسات القادمة', username: 'upcoming_trainee', email: 'upcoming_trainee@example.com', password: 'password123', role: 'trainee' });
    traineeId = traineeRes.body.data.id;
    await clearMustChangePassword('upcoming_trainee@example.com');
    traineeAgent = await loginAgent('upcoming_trainee@example.com', 'password123');

    // قضية مُسندة للمتدرب عبر assistant_lawyer_id
    const caseOwnRes = await adminAgent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({ case_number: 'UPC-CASE-001', title: 'قضية المتدرب', case_type: 'مدني', client_id: clientId, lawyer_id: lawyerId, assistant_lawyer_id: traineeId });
    caseOwnId = caseOwnRes.body.data.id;

    // قضية أخرى بلا أي إسناد للمتدرب
    const caseOtherRes = await adminAgent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({ case_number: 'UPC-CASE-002', title: 'قضية أخرى', case_type: 'مدني', client_id: clientId, lawyer_id: otherLawyerId });
    caseOtherId = caseOtherRes.body.data.id;

    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await adminAgent
        .post('/api/sessions')
        .set('Accept', 'application/json')
        .send({ case_id: caseOwnId, session_date: futureDate, session_type: 'نظر' });
    await adminAgent
        .post('/api/sessions')
        .set('Accept', 'application/json')
        .send({ case_id: caseOtherId, session_date: futureDate, session_type: 'نظر' });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('GET /api/sessions/upcoming', () => {
    // كانت بلا فرع trainee إطلاقًا (بخلاف getAllSessions المجاورة لها)، فيرى
    // المتدرب كل الجلسات القادمة بالمكتب بلا تقييد. الإصلاح يضيف نفس تقييد
    // getAllSessions: c.assistant_lawyer_id = المتدرب.
    test('trainee sees only the upcoming session tied to a case they are assigned to', async () => {
        const res = await traineeAgent.get('/api/sessions/upcoming').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const caseIds = res.body.data.map(s => s.case_id);
        expect(caseIds).toContain(caseOwnId);
        expect(caseIds).not.toContain(caseOtherId);
    });

    test('office owner (admin) still sees every upcoming session in the office', async () => {
        const res = await adminAgent.get('/api/sessions/upcoming').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const caseIds = res.body.data.map(s => s.case_id);
        expect(caseIds).toContain(caseOwnId);
        expect(caseIds).toContain(caseOtherId);
    });
});
