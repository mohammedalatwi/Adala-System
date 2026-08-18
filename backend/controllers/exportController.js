const ExportService = require('../services/ExportService');
const BaseController = require('../utils/BaseController');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const PDFHelper = require('../utils/pdfHelper');
const fs = require('fs');

class ExportController extends BaseController {
    /**
     * تصدير ملخص قضية إلى PDF
     */
    exportCasePDF = this.asyncWrapper(async (req, res) => {
        const { id } = req.params;
        const { caseData, sessions } = await ExportService.getCaseExportData(id, req.session.officeId);

        const doc = new PDFDocument({ margin: 50 });
        PDFHelper.setupDoc(doc);

        const fileName = `case_report_${id}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        doc.pipe(res);
        PDFHelper.drawHeader(doc, 'تقرير ملخص القضية');

        doc.fillColor('#333333').fontSize(16);
        PDFHelper.writeText(doc, `عنوان القضية: ${caseData.title}`, { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(12);
        PDFHelper.writeText(doc, `رقم القضية: ${caseData.case_number}`, { align: 'right' });
        PDFHelper.writeText(doc, `العميل: ${caseData.client_name}`, { align: 'right' });
        PDFHelper.writeText(doc, `المحامي المسؤول: ${caseData.lawyer_name}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#2563eb');
        PDFHelper.writeText(doc, 'تفاصيل القضية', { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(0.5);

        doc.fillColor('#444444').fontSize(11);
        PDFHelper.writeText(doc, `الحالة: ${caseData.status}`, { align: 'right' });
        PDFHelper.writeText(doc, `المحكمة: ${caseData.court_name || 'غير محدد'}`, { align: 'right' });
        PDFHelper.writeText(doc, `تاريخ البدء: ${caseData.start_date || 'غير محدد'}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#2563eb');
        PDFHelper.writeText(doc, 'سجل الجلسات', { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(1);

        if (sessions.length === 0) {
            doc.fontSize(11).fillColor('#888888');
            PDFHelper.writeText(doc, 'لا توجد جلسات مسجلة', { align: 'right' });
        } else {
            sessions.forEach((s, index) => {
                doc.fillColor('#333333').fontSize(12);
                PDFHelper.writeText(doc, `جلسة ${sessions.length - index}: ${s.session_type}`, { align: 'right' });
                doc.fontSize(10).fillColor('#666666');
                PDFHelper.writeText(doc, `التاريخ: ${new Date(s.session_date).toLocaleDateString('ar-SA')}`, { align: 'right' });
                PDFHelper.writeText(doc, `الملاحظات: ${s.session_notes || 'لا توجد'}`, { align: 'right' });
                doc.moveDown(1);
            });
        }

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(10).fillColor('#aaaaaa');
            PDFHelper.writeText(doc, 'تم إنشاء هذا التقرير آلياً عبر نظام عدالة',
                50, doc.page.height - 50, { align: 'center', width: 512 }
            );
        }

        doc.end();
    });

    /**
     * تصدير تقرير مالي
     */
    exportFinancePDF = this.asyncWrapper(async (req, res) => {
        const invoices = await ExportService.getFinanceExportData(req.session.officeId);

        const doc = new PDFDocument({ margin: 50 });
        PDFHelper.setupDoc(doc);

        const fileName = `finance_report_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        doc.pipe(res);
        PDFHelper.drawHeader(doc, 'تقرير المستحقات المالية');

        doc.fillColor('#333333').fontSize(14);
        PDFHelper.writeText(doc, `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, { align: 'right' });
        doc.moveDown(2);

        doc.fontSize(12).fillColor('#2563eb');
        PDFHelper.writeText(doc, 'رقم الفاتورة | العميل | المبلغ المستحق | تاريخ الاستحقاق', { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(1);

        doc.fillColor('#444444').fontSize(10);
        let totalDue = 0;

        invoices.forEach(inv => {
            const due = inv.amount - inv.paid_amount;
            totalDue += due;
            const text = `${inv.invoice_number} | ${inv.client_name} | ${due.toFixed(2)} ر.س | ${inv.due_date}`;
            doc.text(PDFHelper.prepareArabic(text), { align: 'right' });
            doc.moveDown(0.5);
        });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#2563eb');
        PDFHelper.writeText(doc, `إجمالي المتأخرات: ${totalDue.toFixed(2)} ر.س`, { align: 'right' });

        doc.end();
    });

    /**
     * تصدير بيانات القضايا إلى Excel
     */
    exportReportsExcel = this.asyncWrapper(async (req, res) => {
        const cases = await ExportService.getCasesForExcel(req.session.officeId);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cases Overview');

        worksheet.columns = [
            { header: 'رقم القضية', key: 'case_number', width: 20 },
            { header: 'العنوان', key: 'title', width: 30 },
            { header: 'العميل', key: 'client_name', width: 25 },
            { header: 'المحامي', key: 'lawyer_name', width: 25 },
            { header: 'الحالة', key: 'status', width: 15 },
            { header: 'تاريخ البدء', key: 'start_date', width: 15 },
            { header: 'المحكمة', key: 'court_name', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ rightToLeft: true }];

        cases.forEach(c => worksheet.addRow(c));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Adala_Reports_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    });

    /**
     * تصدير بيانات الفواتير إلى Excel
     */
    exportInvoicesExcel = this.asyncWrapper(async (req, res) => {
        const invoices = await ExportService.getAllInvoicesForExport(req.session.officeId);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Invoices Export');

        worksheet.columns = [
            { header: 'رقم الفاتورة', key: 'invoice_number', width: 20 },
            { header: 'العميل', key: 'client_name', width: 25 },
            { header: 'القضية', key: 'case_title', width: 30 },
            { header: 'تاريخ الإصدار', key: 'issue_date', width: 15 },
            { header: 'المبلغ الإجمالي', key: 'amount', width: 15 },
            { header: 'المبلغ المدفوع', key: 'paid_amount', width: 15 },
            { header: 'الحالة', key: 'status', width: 15 }
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ rightToLeft: true }];

        invoices.forEach(inv => worksheet.addRow(inv));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Invoices_Report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    });

    /**
     * تصدير ملخص مالي شامل إلى PDF
     */
    exportFinancialSummary = this.asyncWrapper(async (req, res) => {
        const stats = await ExportService.getDetailedFinancialStats(req.session.officeId);
        const invoices = await ExportService.getFinanceExportData(req.session.officeId);

        const doc = new PDFDocument({ margin: 50 });
        PDFHelper.setupDoc(doc);

        const fileName = `financial_summary_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        doc.pipe(res);
        PDFHelper.drawHeader(doc, 'الملخص المالي العام للمكتب');

        PDFHelper.writeText(doc, 'إحصائيات عامة', { align: 'right' });
        doc.moveDown(1);

        doc.fontSize(12).fillColor('#444444');
        PDFHelper.writeText(doc, `إجمالي مبالغ الفواتير: ${(stats.total_invoiced || 0).toFixed(2)} ر.س`, { align: 'right' });
        PDFHelper.writeText(doc, `إجمالي المبالغ المحصلة: ${(stats.total_paid || 0).toFixed(2)} ر.س`, { align: 'right' });
        PDFHelper.writeText(doc, `إجمالي المصروفات: ${(stats.total_expenses || 0).toFixed(2)} ر.س`, { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor('#2563eb');
        PDFHelper.writeText(doc, `صافي الربح المتوقع: ${(stats.total_paid - (stats.total_expenses || 0)).toFixed(2)} ر.س`, { align: 'right' });

        doc.moveDown(2);
        PDFHelper.writeText(doc, 'الفواتير المستحقة (غير المدفوعة)', { align: 'right' });
        doc.moveDown(1);

        doc.fontSize(11).fillColor('#2563eb');
        PDFHelper.writeText(doc, 'الرقم | العميل | المتبقي | تاريخ الاستحقاق', { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(0.5);

        doc.fillColor('#444444').fontSize(10);
        invoices.forEach(inv => {
            const due = inv.amount - inv.paid_amount;
            const text = `${inv.invoice_number} | ${inv.client_name} | ${due.toFixed(2)} ر.س | ${inv.due_date}`;
            doc.text(PDFHelper.prepareArabic(text), { align: 'right' });
            doc.moveDown(0.5);
        });

        doc.end();
    });
}

module.exports = new ExportController();
