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
        const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
        if (fs.existsSync(fontPath)) {
            doc.font(fontPath);
        } else {
            const altPath = '/Library/Fonts/Arial Unicode.ttf';
            if (fs.existsSync(altPath)) doc.font(altPath);
        }

        const fileName = `case_report_${id}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        doc.pipe(res);
        PDFHelper.drawHeader(doc, 'تقرير ملخص القضية');

        doc.fillColor('#333333').fontSize(16);
        doc.text(PDFHelper.prepareArabic(`عنوان القضية: ${caseData.title}`), { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(PDFHelper.prepareArabic(`رقم القضية: ${caseData.case_number}`), { align: 'right' });
        doc.text(PDFHelper.prepareArabic(`العميل: ${caseData.client_name}`), { align: 'right' });
        doc.text(PDFHelper.prepareArabic(`المحامي المسؤول: ${caseData.lawyer_name}`), { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#2563eb').text(PDFHelper.prepareArabic('تفاصيل القضية'), { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(0.5);

        doc.fillColor('#444444').fontSize(11);
        doc.text(PDFHelper.prepareArabic(`الحالة: ${caseData.status}`), { align: 'right' });
        doc.text(PDFHelper.prepareArabic(`المحكمة: ${caseData.court_name || 'غير محدد'}`), { align: 'right' });
        doc.text(PDFHelper.prepareArabic(`تاريخ البدء: ${caseData.start_date || 'غير محدد'}`), { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(14).fillColor('#2563eb').text(PDFHelper.prepareArabic('سجل الجلسات'), { align: 'right' });
        doc.rect(50, doc.y, 512, 1).stroke('#eeeeee');
        doc.moveDown(1);

        if (sessions.length === 0) {
            doc.fontSize(11).fillColor('#888888').text(PDFHelper.prepareArabic('لا توجد جلسات مسجلة'), { align: 'right' });
        } else {
            sessions.forEach((s, index) => {
                doc.fillColor('#333333').fontSize(12).text(PDFHelper.prepareArabic(`جلسة ${sessions.length - index}: ${s.session_type}`), { align: 'right' });
                doc.fontSize(10).fillColor('#666666').text(PDFHelper.prepareArabic(`التاريخ: ${new Date(s.session_date).toLocaleDateString('ar-SA')}`), { align: 'right' });
                doc.text(PDFHelper.prepareArabic(`الملاحظات: ${s.session_notes || 'لا توجد'}`), { align: 'right' });
                doc.moveDown(1);
            });
        }

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(10).fillColor('#aaaaaa').text(
                PDFHelper.prepareArabic('تم إنشاء هذا التقرير آلياً عبر نظام عدالة'),
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
        const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
        if (fs.existsSync(fontPath)) doc.font(fontPath);

        const fileName = `finance_report_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        doc.pipe(res);
        PDFHelper.drawHeader(doc, 'تقرير المستحقات المالية');

        doc.fillColor('#333333').fontSize(14);
        doc.text(PDFHelper.prepareArabic(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`), { align: 'right' });
        doc.moveDown(2);

        doc.fontSize(12).fillColor('#2563eb');
        doc.text(PDFHelper.prepareArabic('رقم الفاتورة | العميل | المبلغ المستحق | تاريخ الاستحقاق'), { align: 'right' });
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
        doc.text(PDFHelper.prepareArabic(`إجمالي المتأخرات: ${totalDue.toFixed(2)} ر.س`), { align: 'right' });

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
}

module.exports = new ExportController();
