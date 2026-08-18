const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-cc-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const owner = {
    full_name: 'محامية تجريبية',
    username: 'test_owner',
    email: 'test_owner@example.com',
    password: 'password123',
    phone: '0511111111'
};

let agent;
let lawyerId;
let clientId;

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    agent = request.agent(app);
    const registerRes = await agent
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(owner);
    lawyerId = registerRes.body.data.userId;

    await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: owner.email, password: owner.password });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('Clients CRUD', () => {
    test('rejects an unauthenticated request', async () => {
        const res = await request(app)
            .get('/api/clients')
            .set('Accept', 'application/json');

        expect(res.status).toBe(401);
    });

    test('creates a client', async () => {
        const res = await agent
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل تجريبي', phone: '0522222222', email: 'client@example.com' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        clientId = res.body.data.id;
        expect(clientId).toBeDefined();
    });

    test('lists clients including the created one', async () => {
        const res = await agent.get('/api/clients').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.clients.map(c => c.id);
        expect(ids).toContain(clientId);
    });

    test('updates the client', async () => {
        const res = await agent
            .put(`/api/clients/${clientId}`)
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل محدث', phone: '0522222222' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const getRes = await agent.get(`/api/clients/${clientId}`).set('Accept', 'application/json');
        expect(getRes.body.data.client.full_name).toBe('عميل محدث');
    });
});

describe('Cases CRUD', () => {
    let caseId;

    test('creates a case for the client', async () => {
        const res = await agent
            .post('/api/cases')
            .set('Accept', 'application/json')
            .send({
                case_number: 'TEST-CASE-001',
                title: 'قضية تجريبية',
                case_type: 'مدني',
                client_id: clientId,
                lawyer_id: lawyerId
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        caseId = res.body.data.id;
        expect(caseId).toBeDefined();
    });

    test('lists cases including the created one', async () => {
        const res = await agent.get('/api/cases').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.cases.map(c => c.id);
        expect(ids).toContain(caseId);
    });

    test('rejects a duplicate case_number', async () => {
        const res = await agent
            .post('/api/cases')
            .set('Accept', 'application/json')
            .send({
                case_number: 'TEST-CASE-001',
                title: 'قضية مكررة',
                case_type: 'مدني',
                client_id: clientId,
                lawyer_id: lawyerId
            });

        expect(res.body.success).toBe(false);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
