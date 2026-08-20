const path = require('path');
const fs = require('fs');
const os = require('os');

const testDbPath = path.join(os.tmpdir(), `adala-test-user-profile-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = testDbPath;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-jest';

const request = require('supertest');
const { createTestDatabase } = require('./setup/testDb');
const app = require('../../server');
const db = require('../db/database');

const lawyer = {
    full_name: 'محامي بروفايل تجريبي',
    username: 'profile_test_lawyer',
    email: 'profile_test_lawyer@example.com',
    password: 'password123',
    phone: '0500000002'
};

let agent;

beforeAll(async () => {
    await createTestDatabase(testDbPath);
    await db.init();

    agent = request.agent(app);
    await agent
        .post('/api/auth/register')
        .set('Accept', 'application/json')
        .send(lawyer);
    await agent
        .post('/api/auth/login')
        .set('Accept', 'application/json')
        .send({ email: lawyer.email, password: lawyer.password });
});

afterAll(async () => {
    await db.close();
    fs.existsSync(testDbPath) && fs.unlinkSync(testDbPath);
});

describe('GET /api/users/me', () => {
    test('returns the current user\'s own profile fields', async () => {
        const res = await agent
            .get('/api/users/me')
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe(lawyer.email);
        expect(res.body.data.full_name).toBe(lawyer.full_name);
        expect(res.body.data.role).toBe('admin');
        expect(res.body.data.is_active).toBe(1);
    });
});

describe('PUT /api/users/me', () => {
    test('updates own allowed fields', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({
                full_name: 'اسم محدّث',
                phone: '0511111111',
                specialization: 'قانون تجاري',
                license_number: 'LIC-123',
                experience_years: 5,
                bio: 'نبذة محدّثة'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await db.get('SELECT full_name, phone, specialization, license_number, experience_years, bio FROM users WHERE email = ?', [lawyer.email]);
        expect(updated.full_name).toBe('اسم محدّث');
        expect(updated.phone).toBe('0511111111');
        expect(updated.specialization).toBe('قانون تجاري');
        expect(updated.license_number).toBe('LIC-123');
        expect(updated.experience_years).toBe(5);
        expect(updated.bio).toBe('نبذة محدّثة');
    });

    test('rejects the whole request with 400 when role or is_active is present', async () => {
        const before = await db.get('SELECT full_name, role, is_active FROM users WHERE email = ?', [lawyer.email]);

        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة ترقية صلاحيات', role: 'admin', is_active: false });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(400);

        // الرفض يجب أن يكون كليًا: لا يُحدَّث full_name أيضًا رغم أنه حقل مسموح به بمفرده
        const after = await db.get('SELECT full_name, role, is_active FROM users WHERE email = ?', [lawyer.email]);
        expect(after.full_name).toBe(before.full_name);
        expect(after.role).toBe(before.role);
        expect(after.is_active).toBe(before.is_active);
    });

    test('rejects an email change with no current_password', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ email: 'new_email_no_pwd@example.com' });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(400);

        const unchanged = await db.get('SELECT email FROM users WHERE username = ?', [lawyer.username]);
        expect(unchanged.email).toBe(lawyer.email);
    });

    test('rejects an email change with the wrong current_password', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ email: 'new_email_wrong_pwd@example.com', current_password: 'wrong-password' });

        expect(res.body.success).toBe(false);
        expect(res.status).toBe(401);

        const unchanged = await db.get('SELECT email FROM users WHERE username = ?', [lawyer.username]);
        expect(unchanged.email).toBe(lawyer.email);
    });

    test('changes the email when current_password is correct', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ email: 'updated_email@example.com', current_password: lawyer.password });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await db.get('SELECT email FROM users WHERE username = ?', [lawyer.username]);
        expect(updated.email).toBe('updated_email@example.com');
    });
});

// عضو فريق بلا هاتف: POST /api/team/members لا يفرض إرسال phone عند الإنشاء
describe('PUT /api/users/me — مستخدم بلا هاتف مسجّل يقدر يحفظ تعديلات أخرى', () => {
    const phonelessMember = {
        full_name: 'محامٍ بلا هاتف',
        username: 'phoneless_lawyer',
        email: 'phoneless_lawyer@example.com',
        password: 'password123',
        role: 'lawyer'
    };
    let phonelessAgent;

    beforeAll(async () => {
        await agent
            .post('/api/team/members')
            .set('Accept', 'application/json')
            .send(phonelessMember);

        phonelessAgent = request.agent(app);
        await phonelessAgent
            .post('/api/auth/login')
            .set('Accept', 'application/json')
            .send({ email: phonelessMember.email, password: phonelessMember.password });

        // UserService.createUser يضبط must_change_password=1 لكل حساب ينشئه شخص آخر،
        // وهذا يحظر كل مسار API غير المسارات الثلاثة المستثناة (auth/password وما شابه)
        await db.run('UPDATE users SET must_change_password = 0 WHERE email = ?', [phonelessMember.email]);
    });

    test('confirms the account genuinely has no phone on file before testing the fix', async () => {
        const row = await db.get('SELECT phone FROM users WHERE email = ?', [phonelessMember.email]);
        expect(row.phone).toBeNull();
    });

    test('saves other fields when phone is omitted from the payload (the fixed frontend behavior)', async () => {
        const res = await phonelessAgent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: 'محامٍ بلا هاتف — محدّث' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const row = await db.get('SELECT full_name, phone FROM users WHERE email = ?', [phonelessMember.email]);
        expect(row.full_name).toBe('محامٍ بلا هاتف — محدّث');
        expect(row.phone).toBeNull();
    });

    test('still rejects an explicitly empty phone string with 400 (why the frontend omits it instead of sending "")', async () => {
        const res = await phonelessAgent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: 'محاولة إرسال هاتف فارغ', phone: '' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

describe('PUT /api/users/me — تفريغ experience_years يمسح القيمة فعليًا', () => {
    test('sets an initial experience_years value to prepare the clearing test', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: lawyer.full_name, experience_years: 8 });

        expect(res.status).toBe(200);
        const row = await db.get('SELECT experience_years FROM users WHERE username = ?', [lawyer.username]);
        expect(row.experience_years).toBe(8);
    });

    test('sending experience_years: null clears the stored value instead of leaving the old one', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: lawyer.full_name, experience_years: null });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const row = await db.get('SELECT experience_years FROM users WHERE username = ?', [lawyer.username]);
        expect(row.experience_years).toBeNull();
    });

    test('still rejects a negative experience_years value (null is the only accepted "empty")', async () => {
        const res = await agent
            .put('/api/users/me')
            .set('Accept', 'application/json')
            .send({ full_name: lawyer.full_name, experience_years: -1 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});
