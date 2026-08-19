const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-team-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const admin = {
    full_name: 'أدمن تجريبي',
    username: 'test_admin',
    email: 'test_admin@example.com',
    password: 'password123',
    phone: '0500000001'
};

let adminAgent;
let existingClientId;

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

    const clientRes = await adminAgent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل جاهز مسبقًا', phone: '0511111112' });
    existingClientId = clientRes.body.data.id;
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('POST /api/team/members (admin caller)', () => {
    test('creates a lawyer', async () => {
        const res = await adminAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محامي جديد', username: 'new_lawyer', email: 'new_lawyer@example.com', password: 'password123', role: 'lawyer' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test('creates a trainee with supervisor_id and must_change_password set', async () => {
        const res = await adminAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'متدرب جديد', username: 'new_trainee', email: 'new_trainee@example.com', password: 'password123', role: 'trainee' });

        expect(res.status).toBe(201);

        const row = await db.get('SELECT supervisor_id, must_change_password FROM users WHERE id = ?', [res.body.data.id]);
        expect(row.supervisor_id).not.toBeNull();
        expect(row.must_change_password).toBe(1);
    });

    test('creates a portal client account linked to an existing client record', async () => {
        const res = await adminAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل بوابة', username: 'new_portal', email: 'new_portal@example.com', password: 'password123', role: 'client', client_id: existingClientId });

        expect(res.status).toBe(201);

        const row = await db.get('SELECT client_id FROM users WHERE id = ?', [res.body.data.id]);
        expect(row.client_id).toBe(existingClientId);
    });

    test('rejects role=client without a client_id', async () => {
        const res = await adminAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة ناقصة', username: 'bad_portal', email: 'bad_portal@example.com', password: 'password123', role: 'client' });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.success).toBe(false);
    });

    test('rejects role=assistant (removed from the system)', async () => {
        const res = await adminAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة دور محذوف', username: 'bad_role', email: 'bad_role@example.com', password: 'password123', role: 'assistant' });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.body.success).toBe(false);
    });
});

describe('POST /api/team/members (lawyer caller)', () => {
    let lawyerAgent;

    beforeAll(async () => {
        lawyerAgent = request.agent(app);
        await lawyerAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'new_lawyer@example.com', password: 'password123' });
    });

    test('can create a trainee', async () => {
        const res = await lawyerAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'متدرب المحامي', username: 'lawyer_trainee', email: 'lawyer_trainee@example.com', password: 'password123', role: 'trainee' });

        expect(res.status).toBe(201);
    });

    test('is rejected from creating another lawyer', async () => {
        const res = await lawyerAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محامي آخر', username: 'lawyer_lawyer', email: 'lawyer_lawyer@example.com', password: 'password123', role: 'lawyer' });

        expect(res.status).toBe(403);
    });

    test('is rejected from creating a portal client', async () => {
        const res = await lawyerAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة عميل', username: 'lawyer_client', email: 'lawyer_client@example.com', password: 'password123', role: 'client', client_id: existingClientId });

        expect(res.status).toBe(403);
    });
});

describe('POST /api/team/members (unauthorized callers)', () => {
    test('a trainee cannot call this endpoint at all', async () => {
        const traineeAgent = request.agent(app);
        await traineeAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'new_trainee@example.com', password: 'password123' });

        const res = await traineeAgent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة متدرب', username: 'trainee_x', email: 'trainee_x@example.com', password: 'password123', role: 'trainee' });

        expect(res.status).toBe(403);
    });

    test('an unauthenticated request is rejected', async () => {
        const res = await request(app)
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة', username: 'anon_x', email: 'anon_x@example.com', password: 'password123', role: 'trainee' });

        expect(res.status).toBe(401);
    });
});
