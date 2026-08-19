const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-cc-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const bcrypt = require('bcryptjs');
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
let officeId;
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
    officeId = registerRes.body.data.officeId;

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

describe('Client portal role filtering', () => {
    let portalAgent;
    let otherClientId;

    beforeAll(async () => {
        // عميل ثانٍ غير مرتبط بحساب البوابة، للتأكد أن الفلترة تستثنيه فعليًا
        const otherClientRes = await agent
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'عميل آخر', phone: '0544444444', email: 'other@example.com' });
        otherClientId = otherClientRes.body.data.id;

        const passwordHash = await bcrypt.hash('password123', 10);
        await db.run(
            `INSERT INTO users (full_name, username, email, password_hash, role, client_id, office_id)
             VALUES (?, ?, ?, ?, 'client', ?, ?)`,
            ['عميل بوابة', 'test_portal_client', 'portal_client@example.com', passwordHash, clientId, officeId]
        );

        portalAgent = request.agent(app);
        await portalAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: 'portal_client@example.com', password: 'password123' });
    });

    test('client role only sees its own record in the list', async () => {
        const res = await portalAgent.get('/api/clients').set('Accept', 'application/json');

        expect(res.status).toBe(200);
        const ids = res.body.data.clients.map(c => c.id);
        expect(ids).toEqual([clientId]);
    });

    test('client role can view its own record by id', async () => {
        const res = await portalAgent.get(`/api/clients/${clientId}`).set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.data.client.id).toBe(clientId);
    });

    test('client role is rejected when viewing another client by id', async () => {
        const res = await portalAgent.get(`/api/clients/${otherClientId}`).set('Accept', 'application/json');

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    test('client role is rejected from creating a client', async () => {
        const res = await portalAgent
            .post('/api/clients')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة إنشاء', phone: '0555555555' });

        expect(res.status).toBe(403);
    });

    test('client role is rejected from updating its own record', async () => {
        const res = await portalAgent
            .put(`/api/clients/${clientId}`)
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة تعديل' });

        expect(res.status).toBe(403);
    });

    test('client role is rejected from deleting its own record', async () => {
        const res = await portalAgent.delete(`/api/clients/${clientId}`).set('Accept', 'application/json');

        expect(res.status).toBe(403);
    });
});
