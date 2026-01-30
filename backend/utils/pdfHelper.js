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
}

module.exports = PDFHelper;
