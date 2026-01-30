/**
 * reportController.js - نظام التقارير المتقدم
 */

const db = require('../db/database');
const cacheManager = require('../middleware/cache');

class ReportController {

    // ✅ تقرير القضايا الشامل
    generateCasesReport = async (req, res) => {
        try {
            const {
                startDate,
                endDate,
                status,
                case_type,
                lawyer_id,
                page = 1,
                limit = 50
            } = req.query;

            const officeId = req.session.officeId;
            const offset = (page - 1) * limit;

            // إنشاء مفتاح ذاكرة مؤقتة فريد (بما في ذلك معرف المكتب)
            const cacheKey = `cases_report_${officeId}_${startDate}_${endDate}_${status}_${case_type}_${lawyer_id}_${page}_${limit}`;

            // محاولة جلب البيانات من الذاكرة المؤقتة أولاً
            const cachedResult = cacheManager.get(cacheKey);
            if (cachedResult) {
                console.log('📊 جلب تقرير القضايا من الذاكرة المؤقتة');
                return res.json(cachedResult);
            }

            let whereConditions = ['c.is_active = 1', 'c.office_id = ?'];
            let params = [officeId];

            if (startDate && endDate) {
                whereConditions.push('c.created_at BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }

            if (status) {
                whereConditions.push('c.status = ?');
                params.push(status);
            }

            if (case_type) {
                whereConditions.push('c.case_type = ?');
                params.push(case_type);
            }

            if (lawyer_id) {
                whereConditions.push('c.lawyer_id = ?');
                params.push(lawyer_id);
            }

            const whereClause = whereConditions.join(' AND ');

            // جلب البيانات
            const cases = await db.all(`
                SELECT 
                    c.*,
                    cl.full_name as client_name,
                    cl.phone as client_phone,
                    u.full_name as lawyer_name,
                    u.specialization as lawyer_specialization,
                    (SELECT COUNT(*) FROM sessions WHERE case_id = c.id) as sessions_count,
                    (SELECT COUNT(*) FROM documents WHERE case_id = c.id AND is_active = 1) as documents_count,
                    (SELECT MAX(session_date) FROM sessions WHERE case_id = c.id) as last_session_date
                FROM cases c
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                WHERE ${whereClause}
                ORDER BY c.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), parseInt(offset)]);

            // إحصائيات التقرير
            const stats = await this.generateCasesStats(whereClause, params);

            const response = {
                success: true,
                data: {
                    cases,
                    stats,
                    pagination: {
                        total: stats.total_cases,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        pages: Math.ceil(stats.total_cases / limit)
                    },
                    period: {
                        startDate,
                        endDate,
                        generatedAt: new Date().toISOString()
                    }
                }
            };

            // تخزين في الذاكرة المؤقتة لمدة 10 دقائق
            cacheManager.set(cacheKey, response, 10 * 60 * 1000);

            res.json(response);

        } catch (error) {
            console.error('❌ خطأ في إنشاء تقرير القضايا:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء التقرير'
            });
        }
    };

    // ✅ إحصائيات القضايا
    generateCasesStats = async (whereClause, params) => {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_cases,
                    COUNT(CASE WHEN status = 'جديد' THEN 1 END) as new_cases,
                    COUNT(CASE WHEN status = 'قيد الدراسة' THEN 1 END) as in_progress_cases,
                    COUNT(CASE WHEN status = 'قيد التنفيذ' THEN 1 END) as in_action_cases,
                    COUNT(CASE WHEN status = 'منتهي' THEN 1 END) as completed_cases,
                    COUNT(CASE WHEN status = 'ملغي' THEN 1 END) as cancelled_cases,
                    COUNT(CASE WHEN priority = 'عالي' THEN 1 END) as high_priority_cases,
                    COUNT(CASE WHEN priority = 'متوسط' THEN 1 END) as medium_priority_cases,
                    COUNT(CASE WHEN priority = 'منخفض' THEN 1 END) as low_priority_cases,
                    AVG(JULIANDAY(COALESCE(actual_end_date, datetime('now'))) - JULIANDAY(start_date)) as avg_duration_days
                FROM cases 
                WHERE ${whereClause}
            `, params);

            return stats || {};
        } catch (error) {
            console.error('❌ خطأ في جلب إحصائيات القضايا:', error);
            return {};
        }
    };

    // ✅ تقرير أداء المحامين
    generatePerformanceReport = async (req, res) => {
        try {
            const { period = 'month', startDate, endDate } = req.query;
            const officeId = req.session.officeId;

            const cacheKey = `performance_report_${officeId}_${period}_${startDate}_${endDate} `;
            const cachedResult = cacheManager.get(cacheKey);

            if (cachedResult) {
                console.log('📈 جلب تقرير الأداء من الذاكرة المؤقتة');
                return res.json(cachedResult);
            }

            let dateFilter = '';
            let dateParams = [officeId];

            if (startDate && endDate) {
                dateFilter = 'AND c.created_at BETWEEN ? AND ?';
                dateParams = [startDate, endDate];
            } else {
                // فلترة حسب الفترة المحددة
                const dateRanges = {
                    'week': "datetime('now', '-7 days')",
                    'month': "datetime('now', '-1 month')",
                    'quarter': "datetime('now', '-3 months')",
                    'year': "datetime('now', '-1 year')"
                };

                if (dateRanges[period]) {
                    dateFilter = `AND c.created_at >= ${dateRanges[period]} `;
                }
            }

            const performanceData = await db.all(`
            SELECT
            u.id,
                u.full_name,
                u.specialization,
                u.experience_years,
                u.avatar_url,
                COUNT(DISTINCT c.id) as total_cases,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT cl.id) as total_clients,
                COUNT(DISTINCT CASE WHEN c.status = 'منتهي' THEN c.id END) as completed_cases,
                COUNT(DISTINCT CASE WHEN c.status = 'جديد' THEN c.id END) as new_cases,
                COUNT(DISTINCT CASE WHEN c.status = 'قيد الدراسة' THEN c.id END) as in_progress_cases,
                ROUND(
                    CASE 
                            WHEN COUNT(DISTINCT c.id) > 0 
                            THEN(COUNT(DISTINCT CASE WHEN c.status = 'منتهي' THEN c.id END) * 100.0 / COUNT(DISTINCT c.id))
                            ELSE 0 
                        END, 2
                ) as success_rate,
                AVG(
                    CASE 
                            WHEN c.status = 'منتهي' 
                            THEN JULIANDAY(c.actual_end_date) - JULIANDAY(c.start_date)
                            ELSE NULL 
                        END
                ) as avg_case_duration,
                COUNT(DISTINCT CASE WHEN c.priority = 'عالي' THEN c.id END) as high_priority_cases,
                MAX(c.created_at) as last_case_date
                FROM users u
                LEFT JOIN cases c ON u.id = c.lawyer_id AND c.is_active = 1 AND c.office_id = ? ${dateFilter}
                LEFT JOIN sessions s ON c.id = s.case_id
                LEFT JOIN clients cl ON u.id = cl.created_by AND cl.is_active = 1 AND cl.office_id = ?
                WHERE u.role = 'lawyer' AND u.is_active = 1 AND u.office_id = ?
                    GROUP BY u.id
                ORDER BY success_rate DESC, total_cases DESC
            `, [...dateParams, officeId, officeId]);

            // تحليل الأداء
            const performanceAnalysis = this.analyzePerformance(performanceData);

            const response = {
                success: true,
                data: {
                    lawyers: performanceData,
                    analysis: performanceAnalysis,
                    period: {
                        type: period,
                        startDate,
                        endDate,
                        generatedAt: new Date().toISOString()
                    }
                }
            };

            // تخزين في الذاكرة المؤقتة لمدة 15 دقيقة
            cacheManager.set(cacheKey, response, 15 * 60 * 1000);

            res.json(response);

        } catch (error) {
            console.error('❌ خطأ في إنشاء تقرير الأداء:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء تقرير الأداء'
            });
        }
    };

    // ✅ تحليل أداء المحامين
    analyzePerformance = (performanceData) => {
        if (!performanceData || performanceData.length === 0) {
            return {};
        }

        const totalCases = performanceData.reduce((sum, lawyer) => sum + lawyer.total_cases, 0);
        const avgSuccessRate = performanceData.reduce((sum, lawyer) => sum + lawyer.success_rate, 0) / performanceData.length;

        const topPerformers = performanceData
            .filter(lawyer => lawyer.success_rate >= 80)
            .sort((a, b) => b.success_rate - a.success_rate)
            .slice(0, 3);

        const needsImprovement = performanceData
            .filter(lawyer => lawyer.success_rate < 50 && lawyer.total_cases > 0)
            .sort((a, b) => a.success_rate - b.success_rate);

        return {
            totalLawyers: performanceData.length,
            totalCases,
            averageSuccessRate: Math.round(avgSuccessRate * 100) / 100,
            topPerformers: topPerformers.map(lawyer => ({
                name: lawyer.full_name,
                successRate: lawyer.success_rate,
                totalCases: lawyer.total_cases
            })),
            needsImprovement: needsImprovement.map(lawyer => ({
                name: lawyer.full_name,
                successRate: lawyer.success_rate,
                totalCases: lawyer.total_cases
            })),
            busiestLawyer: performanceData.reduce((max, lawyer) =>
                lawyer.total_cases > max.total_cases ? lawyer : max, performanceData[0]
            )
        };
    };

    // ✅ تقرير الجلسات
    generateSessionsReport = async (req, res) => {
        try {
            const { startDate, endDate, status, session_type } = req.query;
            const officeId = req.session.officeId;

            const cacheKey = `sessions_report_${officeId}_${startDate}_${endDate}_${status}_${session_type} `;
            const cachedResult = cacheManager.get(cacheKey);

            if (cachedResult) {
                return res.json(cachedResult);
            }

            let whereConditions = ['s.is_active = 1', 's.office_id = ?'];
            let params = [officeId];

            if (startDate && endDate) {
                whereConditions.push('s.session_date BETWEEN ? AND ?');
                params.push(startDate, endDate);
            }

            if (status) {
                whereConditions.push('s.status = ?');
                params.push(status);
            }

            if (session_type) {
                whereConditions.push('s.session_type = ?');
                params.push(session_type);
            }

            const whereClause = whereConditions.join(' AND ');

            const sessions = await db.all(`
            SELECT
            s.*,
                c.case_number,
                c.title as case_title,
                cl.full_name as client_name,
                u.full_name as lawyer_name,
                CASE 
                        WHEN s.session_date < datetime('now') AND s.status = 'مجدول' THEN 'متأخرة'
                        WHEN s.session_date > datetime('now') THEN 'قادمة'
                        ELSE 'منتهية'
            END as timeline_status
                FROM sessions s
                LEFT JOIN cases c ON s.case_id = c.id
                LEFT JOIN clients cl ON c.client_id = cl.id
                LEFT JOIN users u ON c.lawyer_id = u.id
                WHERE ${whereClause}
                ORDER BY s.session_date DESC
            `, params);

            // إحصائيات الجلسات
            const stats = {
                total: sessions.length,
                upcoming: sessions.filter(s => s.timeline_status === 'قادمة').length,
                overdue: sessions.filter(s => s.timeline_status === 'متأخرة').length,
                completed: sessions.filter(s => s.timeline_status === 'منتهية').length,
                byType: {},
                byStatus: {}
            };

            sessions.forEach(session => {
                stats.byType[session.session_type] = (stats.byType[session.session_type] || 0) + 1;
                stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;
            });

            const response = {
                success: true,
                data: {
                    sessions,
                    stats,
                    period: {
                        startDate,
                        endDate,
                        generatedAt: new Date().toISOString()
                    }
                }
            };

            cacheManager.set(cacheKey, response, 10 * 60 * 1000);
            res.json(response);

        } catch (error) {
            console.error('❌ خطأ في إنشاء تقرير الجلسات:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء تقرير الجلسات'
            });
        }
    };

    // ✅ تقرير مالي (هيكلي للمستقبل)
    generateFinancialReport = async (req, res) => {
        try {
            // هذا هيكل للتقرير المالي - يمكن تطويره لاحقاً
            const financialData = {
                revenue: {
                    total: 0,
                    byMonth: {},
                    byCaseType: {}
                },
                expenses: {
                    total: 0,
                    categories: {}
                },
                profitability: {
                    netProfit: 0,
                    profitMargin: '0%'
                }
            };

            res.json({
                success: true,
                data: financialData,
                message: 'التقرير المالي قيد التطوير'
            });

        } catch (error) {
            console.error('❌ خطأ في إنشاء التقرير المالي:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إنشاء التقرير المالي'
            });
        }
    };

    // ✅ إحصائيات النظام العامة
    getSystemStats = async (req, res) => {
        try {
            const officeId = req.session.officeId;
            const cacheKey = `system_stats_${officeId} `;
            const cachedResult = cacheManager.get(cacheKey);

            if (cachedResult) {
                return res.json(cachedResult);
            }

            const stats = await db.all(`
            --إحصائيات المستخدمين
                SELECT 'users' as category, role as key, COUNT(*) as value 
                FROM users WHERE is_active = 1 AND office_id = ? GROUP BY role
                UNION ALL
            --إحصائيات القضايا
                SELECT 'cases' as category, status as key, COUNT(*) as value 
                FROM cases WHERE is_active = 1 AND office_id = ? GROUP BY status
                UNION ALL
            --إحصائيات العملاء
                SELECT 'clients' as category, 'active' as key, COUNT(*) as value 
                FROM clients WHERE is_active = 1 AND office_id = ?
                UNION ALL
            --إحصائيات الجلسات
                SELECT 'sessions' as category,
                CASE 
                        WHEN session_date > datetime('now') THEN 'upcoming'
                        ELSE 'past'
            END as key,
                COUNT(*) as value 
                FROM sessions WHERE is_active = 1 AND office_id = ? GROUP BY key
                UNION ALL
            --إحصائيات المستندات
                SELECT 'documents' as category, 'total' as key, COUNT(*) as value 
                FROM documents WHERE is_active = 1 AND office_id = ?
                `, [officeId, officeId, officeId, officeId, officeId]);

            const formattedStats = {};
            stats.forEach(stat => {
                if (!formattedStats[stat.category]) {
                    formattedStats[stat.category] = {};
                }
                formattedStats[stat.category][stat.key] = stat.value;
            });

            const response = {
                success: true,
                data: formattedStats,
                generatedAt: new Date().toISOString()
            };

            cacheManager.set(cacheKey, response, 5 * 60 * 1000);
            res.json(response);

        } catch (error) {
            console.error('❌ خطأ في جلب إحصائيات النظام:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء جلب إحصائيات النظام'
            });
        }
    };
}

module.exports = new ReportController();