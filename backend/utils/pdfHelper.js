const arabicReshaper = require('arabic-reshaper');
const fs = require('fs');
const bidiFactory = require('bidi-js');
const bidi = bidiFactory();

/**
 * pdfHelper.js - Utilities for PDF generation (especially Arabic support)
 */
class PDFHelper {
    /**
     * Get the best available Arabic font path
     */
    static getFontPath() {
        const path = require('path');
        const defaultFont = path.join(__dirname, '../assets/fonts/Amiri-Regular.ttf');
        if (fs.existsSync(defaultFont)) return defaultFont;

        const paths = [
            '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
            '/Library/Fonts/Arial Unicode.ttf',
            '/System/Library/Fonts/Arabic/Cairo.ttf' // Fallback for some systems
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    /**
     * Setup a PDF document with standard configuration
     */
    static setupDoc(doc) {
        const fontPath = this.getFontPath();
        if (fontPath) {
            doc.font(fontPath);
        }
        return doc;
    }

    /**
     * Force font and write Arabic text safely
     */
    static writeText(doc, text, x, y, options = {}) {
        const fontPath = this.getFontPath();
        if (fontPath) doc.font(fontPath);

        if (typeof x === 'object') {
            options = x;
            return doc.text(this.prepareArabic(text), options);
        }
        return doc.text(this.prepareArabic(text), x, y, options);
    }

    /**
     * Prepare Arabic text for PDFKit (Reshaping + Bidi)
     */
    static prepareArabic(text) {
        if (!text) return '';
        try {
            // 1. Reshape the Arabic characters first using the correct method
            const reshaped = arabicReshaper.convertArabic(text);

            // 2. Use bidi-js to get the correct visual order for PDFKit (LTR renderer)
            const embeddingLevelsResult = bidi.getEmbeddingLevels(reshaped);
            return bidi.getReorderedString(reshaped, embeddingLevelsResult);
        } catch (error) {
            console.error('Error preparing Arabic text:', error);
            // Fallback for safety
            return text.split('').reverse().join('');
        }
    }

    /**
     * Draw a decorative header with branding
     */
    static drawHeader(doc, title, firmName = 'نظام عدالة للمحاماة') {
        doc.rect(0, 0, 612, 100).fill('#2563eb');

        this.writeText(doc, firmName, 50, 40, { align: 'right', width: 512 });
        doc.fontSize(14);
        this.writeText(doc, title, 50, 70, { align: 'right', width: 512 });

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
        this.writeText(doc, 'معلومات العميل:', 400, 120, { align: 'right' });
        doc.fontSize(14);
        this.writeText(doc, client.full_name, 400, 140, { align: 'right' });
        doc.fontSize(10).fillColor('#666666');
        if (client.national_id) this.writeText(doc, `رقم الهوية: ${client.national_id}`, 400, 160, { align: 'right' });
        this.writeText(doc, `الهاتف: ${client.phone}`, 400, 175, { align: 'right' });

        // Invoice Info (Left Side)
        this.writeText(doc, 'تفاصيل الفاتورة:', 50, 120, { align: 'left' });
        doc.fontSize(10).fillColor('#666666');
        this.writeText(doc, `تاريخ الإصدار: ${invoice.issue_date}`, 50, 140, { align: 'left' });
        this.writeText(doc, `تاريخ الاستحقاق: ${invoice.due_date || 'غير محدد'}`, 50, 155, { align: 'left' });
        this.writeText(doc, `الحالة: ${invoice.status}`, 50, 170, { align: 'left' });

        doc.moveDown(4);

        // Items Table Header
        const tableTop = 230;
        doc.rect(50, tableTop, 512, 25).fill('#f3f4f6');
        doc.fillColor('#374151').fontSize(11);
        const fontPath = this.getFontPath();
        if (fontPath) doc.font(fontPath);

        this.writeText(doc, 'الوصف', 300, tableTop + 7, { width: 250, align: 'right' });
        this.writeText(doc, 'الكمية', 250, tableTop + 7, { width: 50, align: 'center' });
        this.writeText(doc, 'سعر الوحدة', 150, tableTop + 7, { width: 100, align: 'center' });
        this.writeText(doc, 'الإجمالي', 50, tableTop + 7, { width: 100, align: 'left' });

        // Items
        let currentY = tableTop + 35;
        items.forEach(item => {
            doc.fillColor('#4b5563').fontSize(10);
            this.writeText(doc, item.description, 300, currentY, { width: 250, align: 'right' });
            this.writeText(doc, item.quantity.toString(), 250, currentY, { width: 50, align: 'center' });
            this.writeText(doc, item.unit_price.toFixed(2), 150, currentY, { width: 100, align: 'center' });
            this.writeText(doc, (item.quantity * item.unit_price).toFixed(2), 50, currentY, { width: 100, align: 'left' });

            currentY += 25;
            doc.moveTo(50, currentY - 5).lineTo(562, currentY - 5).stroke('#eeeeee');
        });

        // Totals
        currentY += 20;
        doc.rect(350, currentY, 212, 80).fill('#f9fafb');
        doc.fillColor('#333333').fontSize(12);

        this.writeText(doc, `${invoice.amount.toFixed(2)} ر.س`, 350, currentY + 10, { width: 100, align: 'left' });

        this.writeText(doc, 'المبلغ المدفوع:', 450, currentY + 35, { align: 'right' });
        this.writeText(doc, `${invoice.paid_amount.toFixed(2)} ر.س`, 350, currentY + 35, { width: 100, align: 'left' });

        doc.fontSize(14).fillColor('#2563eb');
        this.writeText(doc, 'المبلغ المتبقي:', 450, currentY + 60, { align: 'right' });
        this.writeText(doc, `${(invoice.amount - invoice.paid_amount).toFixed(2)} ر.س`, 350, currentY + 60, { width: 100, align: 'left' });

        // Footer
        this.writeText(doc, 'نشكركم لثقتكم بنا. في حال وجود أي استفسار يرجى التواصل مع المكتب.',
            50, 700, { align: 'center', width: 512 }
        );
    }
}

module.exports = PDFHelper;
