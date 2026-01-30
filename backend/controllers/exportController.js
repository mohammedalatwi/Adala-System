const db = require('../db/database');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const PDFHelper = require('../utils/pdfHelper');
const fs = require('fs');
const path = require('path');

class ExportController {
    /**
     * تصدير ملخص قضية إلى PDF
     */
    async exportCasePDF(req, res) {
        try {
            const { id } = req.params;

            // جلب بيانات القضية
            const caseData = await db.get(`
                SELECT c.*, cl.full_name as client_name, cl.phone as client_phone, u.full_name as lawyer_name
                FROM cases c
                JOIN clients cl ON c.client_id = cl.id
                JOIN users u ON c.lawyer_id = u.id
                WHERE c.id = ? AND c.office_id = ?
            `, [id, req.session.officeId]);

            if (!caseData) {
                return res.status(404).json({ success: false, message: 'القضية غير موجودة' });
            }

            // جلب الجلسات
            const sessions = await db.all('SELECT * FROM sessions WHERE case_id = ? AND office_id = ? AND is_active = 1 ORDER BY session_date DESC', [id, req.session.officeId]);

            // إنشاء ملف PDF
            const doc = new PDFDocument({ margin: 50 });

            // إعدادات الخط العربي
            const fontPath = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';
            if (fs.existsSync(fontPath)) {
                doc.font(fontPath);
            } else {
                console.warn('⚠️ Arabic font not found at', fontPath, '- falling back to internal fonts');
                // Try a common alternative path for macOS
                const altPath = '/Library/Fonts/Arial Unicode.ttf';
                if (fs.existsSync(altPath)) {
                    doc.font(altPath);
                }
            }

            // اسم الملف
            const fileName = `case_report_${id}_${Date.now()}.pdf`;

            // ضبط الرأس
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

            doc.pipe(res);

            // التصميم
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

            // تذييل الصفحة
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(10).fillColor('#aaaaaa').text(
                    PDFHelper.prepareArabic('تم إنشاء هذا التقرير آلياً عبر نظام عدالة'),
                    50,
                    doc.page.height - 50,
                    { align: 'center', width: 512 }
                );
            }

            doc.end();

        } catch (error) {
            console.error('Export PDF error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير التقرير' });
        }
    }

    /**
     * تصدير تقرير مالي (سيتم تطويره لاحقاً)
     */
    async exportFinancePDF(req, res) {
        try {
            // جلب الفواتير غير المدفوعة أو المتأخرة
            const invoices = await db.all(`
                SELECT i.*, cl.full_name as client_name, c.title as case_title
                FROM invoices i
                JOIN clients cl ON i.client_id = cl.id
                LEFT JOIN cases c ON i.case_id = c.id
                WHERE i.status != 'paid' AND i.office_id = ?
                ORDER BY i.due_date ASC
            `, [req.session.officeId]);

            const doc = new PDFDocument({ margin: 50 });

            // إعدادات الخط
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

            // Table Header logic (Simplified for PDFKit)
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
        } catch (error) {
            console.error('Export Finance PDF error:', error);
            res.status(500).json({ success: false, message: 'فشل تصدير التقرير المالي' });
        }
    }

    /**
     * تصدير بيانات القضايا إلى Excel
     */
    async exportReportsExcel(req, res) {
        try {
            const cases = await db.all(`
                SELECT c.*, cl.full_name as client_name, u.full_name as lawyer_name 
                FROM cases c 
                JOIN clients cl ON c.client_id = cl.id
                JOIN users u ON c.lawyer_id = u.id
                WHERE c.office_id = ?
            `, [req.session.officeId]);

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

            // تحسين التنسيق
            worksheet.getRow(1).font = { bold: true };
            worksheet.views = [{ rightToLeft: true }]; // الطريقة الأدق لتفعيل RTL في إكسل

            cases.forEach(c => {
                worksheet.addRow(c);
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Adala_Reports_${Date.now()}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Excel Export Error:', error);
            res.status(500).json({ success: false, message: 'فشل تصدير ملف إكسل' });
        }
    }
}

module.exports = new ExportController();
