const db = require('../db/database');
const bcrypt = require('bcryptjs');

class TeamController {
    // ✅ الحصول على أعضاء الفريق (للمحامي)
    getMyTeam = async (req, res) => {
        try {
            const lawyerId = req.session.userId;
            const role = req.session.userRole;

            const officeId = req.session.officeId;

            let query = '';
            let params = [];

            if (role === 'admin') {
                // المدير يرى الجميع في مكتبه فقط
                query = 'SELECT id, full_name, username, email, phone, role, specialization, is_active, created_at FROM users WHERE office_id = ? AND role IN ("lawyer", "assistant", "trainee")';
                params = [officeId];
            } else {
                // المحامي يرى المتدربين التابعين له في مكتبه
                query = 'SELECT id, full_name, username, email, phone, role, specialization, is_active, created_at FROM users WHERE office_id = ? AND supervisor_id = ?';
                params = [officeId, lawyerId];
            }

            const team = await db.all(query, params);
            res.json({ success: true, team });
        } catch (error) {
            console.error('Get team error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب بيانات الفريق' });
        }
    };

    // ✅ إضافة متدرب جديد
    addTrainee = async (req, res) => {
        try {
            const { full_name, username, email, password, phone, specialization } = req.body;
            const supervisorId = req.session.userId;

            // التحقق من تكرار البيانات
            const existing = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
            if (existing) {
                return res.status(400).json({ success: false, message: 'اسم المستخدم أو البريد الإلكتروني موجود مسبقاً' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const officeId = req.session.officeId;

            await db.run(
                `INSERT INTO users (full_name, username, email, password_hash, phone, role, specialization, supervisor_id, office_id)
                 VALUES (?, ?, ?, ?, ?, 'trainee', ?, ?, ?)`,
                [full_name, username, email, passwordHash, phone, specialization, supervisorId, officeId]
            );

            res.status(201).json({ success: true, message: 'تم إضافة المتدرب بنجاح' });
        } catch (error) {
            console.error('Add trainee error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء إضافة المتدرب' });
        }
    };

    // ✅ حذف عضو من الفريق
    removeMember = async (req, res) => {
        try {
            const { id } = req.params;
            const supervisorId = req.session.userId;
            const role = req.session.userRole;

            // التأكد من أن العضو ينتمي لنفس المكتب
            const officeId = req.session.officeId;

            if (role !== 'admin') {
                const member = await db.get('SELECT id FROM users WHERE id = ? AND supervisor_id = ? AND office_id = ?', [id, supervisorId, officeId]);
                if (!member) {
                    return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف هذا العضو' });
                }
            } else {
                const member = await db.get('SELECT id FROM users WHERE id = ? AND office_id = ?', [id, officeId]);
                if (!member) {
                    return res.status(403).json({ success: false, message: 'العضو غير موجود في مكتبك' });
                }
            }

            // تعطيل الحساب بدلاً من الحذف الفعلي للحفاظ على السجلات
            await db.run('UPDATE users SET is_active = 0 WHERE id = ? AND office_id = ?', [id, officeId]);
            res.json({ success: true, message: 'تم تعطيل حساب العضو بنجاح' });
        } catch (error) {
            console.error('Remove member error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف عضو الفريق' });
        }
    };
}

module.exports = new TeamController();
