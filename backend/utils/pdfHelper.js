const arabicReshaper = require('arabic-reshaper');
const bidiFactory = require('bidi-js');
const bidi = bidiFactory();

/**
 * pdfHelper.js - Utilities for PDF generation (especially Arabic support)
 */
class PDFHelper {
    /**
     * Prepare Arabic text for PDFKit (Reshaping + Bidi)
     */
    static prepareArabic(text) {
        if (!text) return '';

        try {
            // 1. Reshape the Arabic characters first
            const reshaped = arabicReshaper.reshape(text);

            // 2. Use bidi-js to handle the logical to visual reordering
            // getVisual takes logical text and returns visual text for RTL rendering
            return bidi.getVisual(reshaped);
        } catch (error) {
            console.error('Error preparing Arabic text:', error);
            // Fallback to simple reverse if bidi fails, but return something
            return text.split('').reverse().join('');
        }
    }

    /**
     * Draw a decorative header with branding
     */
    static drawHeader(doc, title, firmName = 'نظام عدالة للمحاماة') {
        doc.rect(0, 0, 612, 100).fill('#2563eb');

        doc.fillColor('white')
            .fontSize(24)
            .text(this.prepareArabic(firmName), 50, 40, { align: 'right', width: 512 });

        doc.fontSize(14)
            .text(this.prepareArabic(title), 50, 70, { align: 'right', width: 512 });

        doc.moveDown(4);
    }

    /**
     * Draw a professional invoice
     */
    static drawInvoice(doc, data) {
        const {
            office,
            invoice,
            client,
            items
        } = data;

        // Header Section
        this.drawHeader(doc, `فاتورة ضريبية - ${invoice.invoice_number}`, office.name);

        doc.fillColor('#333333').fontSize(12);

        // Client Info (Right Side)
        doc.text(this.prepareArabic('معلومات العميل:'), 400, 120, { align: 'right' });
        doc.fontSize(14).text(this.prepareArabic(client.full_name), 400, 140, { align: 'right' });
        doc.fontSize(10).fillColor('#666666');
        if (client.national_id) doc.text(this.prepareArabic(`رقم الهوية: ${client.national_id}`), 400, 160, { align: 'right' });
        doc.text(this.prepareArabic(`الهاتف: ${client.phone}`), 400, 175, { align: 'right' });

        // Invoice Info (Left Side)
        doc.fillColor('#333333').fontSize(12);
        doc.text(this.prepareArabic('تفاصيل الفاتورة:'), 50, 120, { align: 'left' });
        doc.fontSize(10).fillColor('#666666');
        doc.text(this.prepareArabic(`تاريخ الإصدار: ${invoice.issue_date}`), 50, 140, { align: 'left' });
        doc.text(this.prepareArabic(`تاريخ الاستحقاق: ${invoice.due_date || 'غير محدد'}`), 50, 155, { align: 'left' });
        doc.text(this.prepareArabic(`الحالة: ${invoice.status}`), 50, 170, { align: 'left' });

        doc.moveDown(4);

        // Items Table Header
        const tableTop = 230;
        doc.rect(50, tableTop, 512, 25).fill('#f3f4f6');
        doc.fillColor('#374151').fontSize(11).font('/System/Library/Fonts/Supplemental/Arial Unicode.ttf');

        doc.text(this.prepareArabic('الوصف'), 300, tableTop + 7, { width: 250, align: 'right' });
        doc.text(this.prepareArabic('الكمية'), 250, tableTop + 7, { width: 50, align: 'center' });
        doc.text(this.prepareArabic('سعر الوحدة'), 150, tableTop + 7, { width: 100, align: 'center' });
        doc.text(this.prepareArabic('الإجمالي'), 50, tableTop + 7, { width: 100, align: 'left' });

        // Items
        let currentY = tableTop + 35;
        items.forEach(item => {
            doc.fillColor('#4b5563').fontSize(10);
            doc.text(this.prepareArabic(item.description), 300, currentY, { width: 250, align: 'right' });
            doc.text(item.quantity.toString(), 250, currentY, { width: 50, align: 'center' });
            doc.text(`${item.unit_price.toFixed(2)}`, 150, currentY, { width: 100, align: 'center' });
            doc.text(`${(item.quantity * item.unit_price).toFixed(2)}`, 50, currentY, { width: 100, align: 'left' });

            currentY += 25;
            doc.moveTo(50, currentY - 5).lineTo(562, currentY - 5).stroke('#eeeeee');
        });

        // Totals
        currentY += 20;
        doc.rect(350, currentY, 212, 80).fill('#f9fafb');
        doc.fillColor('#333333').fontSize(12);

        doc.text(this.prepareArabic('الإجمالي الفرعي:'), 450, currentY + 10, { align: 'right' });
        doc.text(`${invoice.amount.toFixed(2)} ر.س`, 350, currentY + 10, { width: 100, align: 'left' });

        doc.text(this.prepareArabic('المبلغ المدفوع:'), 450, currentY + 35, { align: 'right' });
        doc.text(`${invoice.paid_amount.toFixed(2)} ر.س`, 350, currentY + 35, { width: 100, align: 'left' });

        doc.fontSize(14).fillColor('#2563eb');
        doc.text(this.prepareArabic('المبلغ المتبقي:'), 450, currentY + 60, { align: 'right' });
        doc.text(`${(invoice.amount - invoice.paid_amount).toFixed(2)} ر.س`, 350, currentY + 60, { width: 100, align: 'left' });

        // Footer
        doc.fontSize(10).fillColor('#9ca3af').text(
            this.prepareArabic('نشكركم لثقتكم بنا. في حال وجود أي استفسار يرجى التواصل مع المكتب.'),
            50, 700, { align: 'center', width: 512 }
        );
    }
}

module.exports = PDFHelper;
