const Database = require('../db/database');
const db = new Database();

class ClientController {
    // ✅ إنشاء عميل جديد
    createClient = async (req, res) => {
        try {
            const {
                full_name,
                email,
                phone,
                alternate_phone,
                address,
                national_id,
                date_of_birth,
                gender,
                occupation,
                company,
                notes,
                emergency_contact_name,
                emergency_contact_phone
            } = req.body;

            // التحقق من الرقم الوطني إذا تم تقديمه
            if (national_id) {
                const existingClient = await db.get(
                    'SELECT id FROM clients WHERE national_id = ?',
                    [national_id]
                );

                if (existingClient) {
                    return res.status(400).json({
                        success: false,
                        message: 'الرقم الوطني موجود مسبقاً'
                    });
                }
            }

            const result = await db.run(
                `INSERT INTO clients (
                    full_name, email, phone, alternate_phone, address, national_id,
                    date_of_birth, gender, occupation, company, notes,
                    emergency_contact_name, emergency_contact_phone, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    full_name, email, phone, alternate_phone, address, national_id,
                    date_of_birth, gender, occupation, company, notes,
                    emergency_contact_name, emergency_contact_phone, req.session.userId
                ]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'create', 'client', result.id, `إنشاء عميل جديد: ${full_name}`]
            );

            res.status(201).json({
                success: true,
                message: 'تم إنشاء العميل بنجاح',
                data: { id: result.id, full_name, phone }
            });

        } catch (error) {
            console.error('Create client error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء العميل'
            });
        }
    };

    // ✅ جلب جميع العملاء
    getAllClients = async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                search
            } = req.query;

            const offset = (page - 1) * limit;
            let whereConditions = ['c.is_active = 1'];
            let params = [];

            if (search) {
                whereConditions.push('(c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.national_id LIKE ?)');
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            const whereClause = whereConditions.join(' AND ');

            // جلب العملاء
            const clients = await db.all(`
                SELECT 
                    c.*,
                    u.full_name as created_by_name,
                    (SELECT COUNT(*) FROM cases WHERE client_id = c.id) as cases_count
                FROM clients c
                LEFT JOIN users u ON c.created_by = u.id
                WHERE ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            // جلب العدد الإجمالي
            const totalResult = await db.get(`
                SELECT COUNT(*) as total 
                FROM clients c
                WHERE ${whereClause}
            `, params);

            res.json({
                success: true,
                data: clients,
                pagination: {
                    total: totalResult.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalResult.total / limit)
                }
            });

        } catch (error) {
            console.error('Get clients error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب العملاء'
            });
        }
    };

    // ✅ جلب عميل محدد
    getClientById = async (req, res) => {
        try {
            const { id } = req.params;

            const client = await db.get(`
                SELECT 
                    c.*,
                    u.full_name as created_by_name
                FROM clients c
                LEFT JOIN users u ON c.created_by = u.id
                WHERE c.id = ? AND c.is_active = 1
            `, [id]);

            if (!client) {
                return res.status(404).json({
                    success: false,
                    message: 'العميل غير موجود'
                });
            }

            // جلب قضايا العميل
            const cases = await db.all(`
                SELECT * FROM cases 
                WHERE client_id = ? 
                ORDER BY created_at DESC
            `, [id]);

            res.json({
                success: true,
                data: {
                    ...client,
                    cases
                }
            });

        } catch (error) {
            console.error('Get client error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب العميل'
            });
        }
    };

    // ✅ تحديث عميل
    updateClient = async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // التحقق من وجود العميل
            const existingClient = await db.get(
                'SELECT id, full_name FROM clients WHERE id = ? AND is_active = 1',
                [id]
            );

            if (!existingClient) {
                return res.status(404).json({
                    success: false,
                    message: 'العميل غير موجود'
                });
            }

            const allowedFields = [
                'full_name', 'email', 'phone', 'alternate_phone', 'address',
                'national_id', 'date_of_birth', 'gender', 'occupation',
                'company', 'notes', 'emergency_contact_name', 'emergency_contact_phone'
            ];

            const updates = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key) && updateData[key] !== undefined) {
                    updates.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            });

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا توجد بيانات لتحديثها'
                });
            }

            updates.push('updated_at = datetime("now")');
            values.push(id);

            await db.run(
                `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'update', 'client', id, `تحديث بيانات العميل: ${existingClient.full_name}`]
            );

            res.json({
                success: true,
                message: 'تم تحديث العميل بنجاح'
            });

        } catch (error) {
            console.error('Update client error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث العميل'
            });
        }
    };

    // ✅ حذف عميل
    deleteClient = async (req, res) => {
        try {
            const { id } = req.params;

            // التحقق من وجود العميل
            const existingClient = await db.get(
                'SELECT id, full_name FROM clients WHERE id = ? AND is_active = 1',
                [id]
            );

            if (!existingClient) {
                return res.status(404).json({
                    success: false,
                    message: 'العميل غير موجود'
                });
            }

            // التحقق من عدم وجود قضايا مرتبطة
            const casesCount = await db.get(
                'SELECT COUNT(*) as count FROM cases WHERE client_id = ?',
                [id]
            );

            if (casesCount.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'لا يمكن حذف العميل لأنه مرتبط بقضايا'
                });
            }

            await db.run(
                'UPDATE clients SET is_active = 0, updated_at = datetime("now") WHERE id = ?',
                [id]
            );

            // تسجيل النشاط
            await db.run(
                'INSERT INTO activities (user_id, action_type, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
                [req.session.userId, 'delete', 'client', id, `حذف العميل: ${existingClient.full_name}`]
            );

            res.json({
                success: true,
                message: 'تم حذف العميل بنجاح'
            });

        } catch (error) {
            console.error('Delete client error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء حذف العميل'
            });
        }
    };

    // ✅ إحصائيات العملاء
    getClientStats = async (req, res) => {
        try {
            const stats = await db.all(`
                SELECT 
                    COUNT(*) as total_clients,
                    COUNT(CASE WHEN date('now') - date(created_at) <= 30 THEN 1 END) as new_this_month,
                    (SELECT COUNT(*) FROM cases) as total_cases,
                    (SELECT COUNT(DISTINCT client_id) FROM cases) as clients_with_cases
                FROM clients 
                WHERE is_active = 1
            `);

            const occupationStats = await db.all(`
                SELECT occupation, COUNT(*) as count
                FROM clients 
                WHERE is_active = 1 AND occupation IS NOT NULL
                GROUP BY occupation
                ORDER BY count DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    overview: stats[0],
                    byOccupation: occupationStats
                }
            });

        } catch (error) {
            console.error('Client stats error:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات العملاء'
            });
        }
    };
}

module.exports = new ClientController();