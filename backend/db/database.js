const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config/config');
const fs = require('fs');

class Database {
    constructor() {
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            // التأكد من وجود مجلد قاعدة البيانات
            const dbDir = path.dirname(config.database.path);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(config.database.path, (err) => {
                if (err) {
                    console.error('❌ فشل في الاتصال بقاعدة البيانات:', err.message);
                    reject(err);
                    return;
                }

                console.log('✅ تم الاتصال بقاعدة البيانات:', config.database.path);
                console.log('📂 Absolute Path:', path.resolve(config.database.path));

                // تفعيل المفاتيح الخارجية
                this.db.run('PRAGMA foreign_keys = ON');

                // تحسين الأداء
                this.db.run('PRAGMA journal_mode = WAL');
                this.db.run('PRAGMA synchronous = NORMAL');
                this.db.run('PRAGMA cache_size = -64000');

                resolve(this.db);
            });
        });
    }

    // ✅ تنفيذ استعلام
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    // ✅ جلب صف واحد
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    // ✅ جلب جميع الصفوف
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    // ✅ بدء transaction
    beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    // ✅ تأكيد transaction
    commit() {
        return this.run('COMMIT');
    }

    // ✅ تراجع transaction
    rollback() {
        return this.run('ROLLBACK');
    }

    // ✅ إغلاق الاتصال
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('✅ تم إغلاق اتصال قاعدة البيانات');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // ✅ التحقق من اتصال قاعدة البيانات
    healthCheck() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT 1 as health', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row.health === 1);
            });
        });
    }

    // ✅ جلب إحصائيات النظام
    async getSystemStats(userId = null) {
        try {
            let userFilter = '';
            let params = [];

            if (userId) {
                userFilter = 'WHERE lawyer_id = ?';
                params = [userId];
            }

            const stats = await this.all(`
                SELECT 
                    (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users,
                    (SELECT COUNT(*) FROM clients WHERE is_active = 1) as total_clients,
                    (SELECT COUNT(*) FROM cases ${userFilter}) as total_cases,
                    (SELECT COUNT(*) FROM cases ${userFilter ? userFilter + ' AND ' : 'WHERE '} status = 'منتهي') as completed_cases,
                    (SELECT COUNT(*) FROM cases ${userFilter ? userFilter + ' AND ' : 'WHERE '} status IN ('جديد', 'قيد الدراسة', 'قيد التنفيذ')) as active_cases,
                    (SELECT COUNT(*) FROM cases ${userFilter ? userFilter + ' AND ' : 'WHERE '} priority = 'عاجل') as urgent_cases,
                    (SELECT COUNT(*) FROM sessions) as total_sessions,
                    (SELECT COUNT(*) FROM sessions WHERE session_date > datetime('now') AND status = 'مجدول') as upcoming_sessions,
                    (SELECT COUNT(*) FROM documents) as total_documents,
                    (SELECT COUNT(*) FROM tasks WHERE status != 'مكتمل') as pending_tasks
            `, params);
            return stats[0];
        } catch (error) {
            console.error('Error getting system stats:', error);
            throw error;
        }
    }

    // ✅ البحث المتقدم
    async advancedSearch(query, filters = {}) {
        try {
            let whereConditions = ['1=1'];
            let params = [];

            if (query) {
                whereConditions.push('(title LIKE ? OR description LIKE ? OR case_number LIKE ?)');
                params.push(`%${query}%`, `%${query}%`, `%${query}%`);
            }

            // تطبيق الفلاتر
            if (filters.status) {
                whereConditions.push('status = ?');
                params.push(filters.status);
            }

            if (filters.case_type) {
                whereConditions.push('case_type = ?');
                params.push(filters.case_type);
            }

            if (filters.priority) {
                whereConditions.push('priority = ?');
                params.push(filters.priority);
            }

            if (filters.lawyer_id) {
                whereConditions.push('lawyer_id = ?');
                params.push(filters.lawyer_id);
            }

            const whereClause = whereConditions.join(' AND ');

            const results = await this.all(`
                SELECT 
                    c.*,
                    cl.full_name as client_name,
                    cl.phone as client_phone,
                    u.full_name as lawyer_name,
                    (SELECT COUNT(*) FROM sessions s WHERE s.case_id = c.id) as sessions_count,
                    (SELECT COUNT(*) FROM documents d WHERE d.case_id = c.id) as documents_count
                FROM cases c
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                WHERE ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, filters.limit || 50, filters.offset || 0]);

            const total = await this.get(`
                SELECT COUNT(*) as count 
                FROM cases c
                WHERE ${whereClause}
            `, params);

            return {
                data: results,
                total: total.count,
                limit: filters.limit || 50,
                offset: filters.offset || 0
            };
        } catch (error) {
            console.error('Error in advanced search:', error);
            throw error;
        }
    }

    // ✅ نسخ احتياطي للبيانات
    async backupDatabase(backupPath) {
        return new Promise((resolve, reject) => {
            const backupDB = new sqlite3.Database(backupPath);
            this.db.backup(backupDB, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                backupDB.close();
                resolve();
            });
        });
    }

    // ✅ استعادة البيانات
    async restoreDatabase(backupPath) {
        return new Promise((resolve, reject) => {
            const backupDB = new sqlite3.Database(backupPath);
            backupDB.backup(this.db, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                backupDB.close();
                resolve();
            });
        });
    }
}

// Create and export a singleton instance
const db = new Database();
module.exports = db;