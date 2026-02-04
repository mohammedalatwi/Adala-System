const ReportService = require('../services/ReportService');
const BaseController = require('../utils/BaseController');
const cacheManager = require('../middleware/cache');

class ReportController extends BaseController {
    // ✅ تقرير القضايا الشامل
    generateCasesReport = this.asyncWrapper(async (req, res) => {
        const { startDate, endDate, status, case_type, lawyer_id, page = 1, limit = 50 } = req.query;
        const officeId = req.session.officeId;

        const cacheKey = `cases_report_${officeId}_${startDate}_${endDate}_${status}_${case_type}_${lawyer_id}_${page}_${limit}`;
        const cachedResult = cacheManager.get(cacheKey);
        if (cachedResult) return this.sendSuccess(res, cachedResult.data);

        const result = await ReportService.generateCasesReport(req.query, officeId);
        const responseData = {
            ...result,
            period: { startDate, endDate, generatedAt: new Date().toISOString() }
        };

        cacheManager.set(cacheKey, { success: true, data: responseData }, 10 * 60 * 1000);
        this.sendSuccess(res, responseData);
    });

    // ✅ تقرير أداء المحامين
    generatePerformanceReport = this.asyncWrapper(async (req, res) => {
        const { period = 'month', startDate, endDate } = req.query;
        const officeId = req.session.officeId;

        const cacheKey = `performance_report_${officeId}_${period}_${startDate}_${endDate}`;
        const cachedResult = cacheManager.get(cacheKey);
        if (cachedResult) return this.sendSuccess(res, cachedResult.data);

        const result = await ReportService.generatePerformanceReport(req.query, officeId);
        const responseData = {
            ...result,
            period: { type: period, startDate, endDate, generatedAt: new Date().toISOString() }
        };

        cacheManager.set(cacheKey, { success: true, data: responseData }, 15 * 60 * 1000);
        this.sendSuccess(res, responseData);
    });

    // ✅ تقرير الجلسات
    generateSessionsReport = this.asyncWrapper(async (req, res) => {
        const { startDate, endDate, status, session_type } = req.query;
        const officeId = req.session.officeId;

        const cacheKey = `sessions_report_${officeId}_${startDate}_${endDate}_${status}_${session_type}`;
        const cachedResult = cacheManager.get(cacheKey);
        if (cachedResult) return this.sendSuccess(res, cachedResult.data);

        const result = await ReportService.generateSessionsReport(req.query, officeId);
        const responseData = {
            ...result,
            period: { startDate, endDate, generatedAt: new Date().toISOString() }
        };

        cacheManager.set(cacheKey, { success: true, data: responseData }, 10 * 60 * 1000);
        this.sendSuccess(res, responseData);
    });

    // ✅ تقرير مالي شامل
    generateFinancialReport = this.asyncWrapper(async (req, res) => {
        const result = await ReportService.generateFinancialReport(req.query, req.session.officeId);
        this.sendSuccess(res, result);
    });

    // ✅ إحصائيات النظام العامة
    getSystemStats = this.asyncWrapper(async (req, res) => {
        const officeId = req.session.officeId;
        const cacheKey = `system_stats_${officeId}`;
        const cachedResult = cacheManager.get(cacheKey);
        if (cachedResult) return this.sendSuccess(res, cachedResult.data);

        const stats = await ReportService.getSystemStats(officeId);
        const responseData = {
            ...stats,
            generatedAt: new Date().toISOString()
        };

        cacheManager.set(cacheKey, { success: true, data: responseData }, 5 * 60 * 1000);
        this.sendSuccess(res, responseData);
    });
}

module.exports = new ReportController();