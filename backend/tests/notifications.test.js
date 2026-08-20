const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-notifications-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');
const NotificationService = require('../services/NotificationService');

const admin = {
    full_name: 'أدمن تجريبي',
    username: 'notif_admin',
    email: 'notif_admin@example.com',
    password: 'password123',
    phone: '0500000020'
};

let adminAgent;
let adminId, officeId, lawyerId, traineeId, clientId, caseId;

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    adminAgent = request.agent(app);
    const registerRes = await adminAgent
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(admin);
    adminId = registerRes.body.data.userId;
    officeId = registerRes.body.data.officeId;

    await adminAgent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: admin.email, password: admin.password });

    const lawyerRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'محامي الإشعارات', username: 'notif_lawyer', email: 'notif_lawyer@example.com', password: 'password123', role: 'lawyer' });
    lawyerId = lawyerRes.body.data.id;

    const traineeRes = await adminAgent
        .post('/api/team/members')
        .set('Accept', 'application/json')
        .send({ full_name: 'متدرب الإشعارات', username: 'notif_trainee', email: 'notif_trainee@example.com', password: 'password123', role: 'trainee' });
    traineeId = traineeRes.body.data.id;

    const clientRes = await adminAgent
        .post('/api/clients')
        .set('Accept', 'application/json')
        .send({ full_name: 'عميل الإشعارات', phone: '0533333334' });
    clientId = clientRes.body.data.id;

    // قضية مُسندة لمحامٍ ومتدرب معًا حتى يشمل تذكير الجلسة الاثنين
    const caseRes = await adminAgent
        .post('/api/cases')
        .set('Accept', 'application/json')
        .send({
            case_number: 'CASE-NOTIF-1',
            title: 'قضية تجريبية للإشعارات',
            case_type: 'مدني',
            client_id: clientId,
            lawyer_id: lawyerId,
            assistant_lawyer_id: traineeId
        });
    caseId = caseRes.body.data.id;
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('إنشاء إشعار عند جدولة جلسة جديدة (SessionService.createSession)', () => {
    test('يُنشئ صفًا فعليًا بجدول notifications لمنشئ الجلسة', async () => {
        // تاريخ بعيد (+30 يومًا) حتى لا يقع أبدًا ضمن نوافذ تذكير الجلسات (أقصاها 7 أيام)
        // فلا يتداخل مع سيناريو التذكير أدناه
        const farFutureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const sessionRes = await adminAgent
            .post('/api/sessions')
            .set('Accept', 'application/json')
            .send({ case_id: caseId, session_date: farFutureDate, session_type: 'نظر' });

        expect(sessionRes.status).toBe(201);
        const sessionId = sessionRes.body.data.id;

        const notif = await db.get(
            `SELECT * FROM notifications WHERE user_id = ? AND related_entity_type = 'session' AND related_entity_id = ?`,
            [adminId, sessionId]
        );

        expect(notif).toBeTruthy();
        expect(notif.title).toBe('جلسة جديدة');
        expect(notif.type).toBe('info');
        expect(notif.office_id).toBe(officeId);
        expect(notif.message).toContain('قضية تجريبية للإشعارات');
    });
});

describe('تذكير الجلسة القادمة (NotificationService.checkUpcomingSessions)', () => {
    let reminderSessionId;

    beforeAll(async () => {
        // جلسة بعد ساعة تقريبًا: تقع ضمن نافذة التذكير فتُطلق الإشعار للمحامي والمتدرب معًا
        const soonDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const result = await db.run(
            `INSERT INTO sessions (case_id, session_number, session_date, session_type, status, sent_reminders, office_id)
             VALUES (?, 1, ?, 'نظر', 'مجدول', '[]', ?)`,
            [caseId, soonDate, officeId]
        );
        reminderSessionId = result.id;

        await NotificationService.checkUpcomingSessions();
    });

    test('يُنشئ صفًا فعليًا للمحامي المسؤول', async () => {
        const notif = await db.get(
            `SELECT * FROM notifications WHERE user_id = ? AND related_entity_type = 'session' AND related_entity_id = ?`,
            [lawyerId, reminderSessionId]
        );

        expect(notif).toBeTruthy();
        expect(notif.title).toBe('تذكير بجلسة قادمة');
        expect(notif.type).toBe('warning');
        expect(notif.office_id).toBe(officeId);
    });

    test('يُنشئ صفًا فعليًا للمتدرب المساعد (assistant_lawyer_id)', async () => {
        const notif = await db.get(
            `SELECT * FROM notifications WHERE user_id = ? AND related_entity_type = 'session' AND related_entity_id = ?`,
            [traineeId, reminderSessionId]
        );

        expect(notif).toBeTruthy();
        expect(notif.title).toBe('تذكير بجلسة قادمة');
        expect(notif.type).toBe('warning');
        expect(notif.office_id).toBe(officeId);
    });
});

describe('تنبيه المهمة المتأخرة (NotificationService.checkOverdueTasks)', () => {
    let overdueTaskId;

    beforeAll(async () => {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const result = await db.run(
            `INSERT INTO tasks (case_id, title, assigned_to, due_date, status, notification_sent, office_id)
             VALUES (?, 'مهمة متأخرة تجريبية', ?, ?, 'قيد الانتظار', 0, ?)`,
            [caseId, lawyerId, pastDate, officeId]
        );
        overdueTaskId = result.id;

        await NotificationService.checkOverdueTasks();
    });

    test('يُنشئ صفًا فعليًا للمُسند إليه المهمة', async () => {
        const notif = await db.get(
            `SELECT * FROM notifications WHERE user_id = ? AND related_entity_type = 'task' AND related_entity_id = ?`,
            [lawyerId, overdueTaskId]
        );

        expect(notif).toBeTruthy();
        expect(notif.title).toBe('تنبيه: مهمة متأخرة');
        expect(notif.type).toBe('danger');
        expect(notif.office_id).toBe(officeId);
    });
});
