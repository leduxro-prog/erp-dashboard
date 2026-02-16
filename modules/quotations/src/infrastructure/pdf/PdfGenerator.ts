import PDFDocument from 'pdfkit';
import { Quote } from '../../domain/entities/Quote';
import { IQuotePdfGenerator } from '../../domain/services/IQuotePdfGenerator';

export class PdfGenerator implements IQuotePdfGenerator {
  async generatePdf(
    quote: Quote,
    logoUrl?: string,
    companyDetails?: any,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          bufferPages: true,
          margin: 50,
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.generateHeader(doc, logoUrl, companyDetails);
        this.generateCustomerSection(doc, quote);
        this.generateItemsTable(doc, quote);
        this.generateTotalsSection(doc, quote);
        this.generateFooter(doc, quote, companyDetails);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private generateHeader(
    doc: PDFKit.PDFDocument,
    logoUrl?: string,
    companyDetails?: any,
  ): void {
    // Logo and company info
    if (logoUrl) {
      doc.image(logoUrl, 50, 50, { width: 80 });
    }

    const companyStartX = logoUrl ? 150 : 50;
    doc.fontSize(16).font('Helvetica-Bold').text(companyDetails?.name || 'Company Name', companyStartX, 50);
    doc.fontSize(10).font('Helvetica').text(companyDetails?.address || 'Address', companyStartX, 75);
    doc.text('Phone: ' + (companyDetails?.phone || '+40 XXX XXX XXX'), companyStartX, 90);
    doc.text('Email: ' + (companyDetails?.email || 'info@company.com'), companyStartX, 105);
    if (companyDetails?.taxId) {
      doc.text('Tax ID: ' + companyDetails.taxId, companyStartX, 120);
    }

    // Quote title and number
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('QUOTATION', 400, 50, { align: 'right' });
    doc.fontSize(10).text('Quote #: ' + this.formatDate(new Date()), 400, 75, { align: 'right' });
    doc.text('Quote Number: ' + `${this.formatDate(new Date())}`, 400, 90, {
      align: 'right',
    });

    doc.moveTo(50, 145).lineTo(550, 145).stroke();
  }

  private generateCustomerSection(doc: PDFKit.PDFDocument, quote: Quote): void {
    doc.fontSize(11).font('Helvetica-Bold').text('CUSTOMER INFORMATION', 50, 160);

    const customerInfo = [
      `Name: ${quote.customerName}`,
      `Email: ${quote.customerEmail}`,
      `Invoice To:`,
      `${quote.billingAddress.street}`,
      `${quote.billingAddress.postcode} ${quote.billingAddress.city}, ${quote.billingAddress.country}`,
    ];

    let y = 180;
    doc.fontSize(10).font('Helvetica');
    customerInfo.forEach(line => {
      doc.text(line, 50, y);
      y += 15;
    });

    doc.fontSize(11).font('Helvetica-Bold').text('SHIP TO:', 350, 180);
    const shipInfo = [
      quote.shippingAddress.street,
      `${quote.shippingAddress.postcode} ${quote.shippingAddress.city}, ${quote.shippingAddress.country}`,
    ];
    let shippingY = 200;
    doc.fontSize(10).font('Helvetica');
    shipInfo.forEach(line => {
      doc.text(line, 350, shippingY);
      shippingY += 15;
    });
  }

  private generateItemsTable(doc: PDFKit.PDFDocument, quote: Quote): void {
    const tableTop = 280;
    const itemsStartY = tableTop + 25;

    // Table header
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Description', 50, tableTop)
      .text('SKU', 250, tableTop)
      .text('Qty', 320, tableTop)
      .text('Unit Price', 370, tableTop)
      .text('Total', 470, tableTop, { align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = itemsStartY;
    doc.fontSize(10).font('Helvetica');

    quote.items.forEach((item, index) => {
      const productName = item.productName || 'Product';
      doc.text(productName, 50, y, { width: 180 });

      doc.text(item.sku, 250, y);
      doc.text(item.quantity.toString(), 320, y);
      doc.text(`${quote.currency} ${item.unitPrice.toFixed(2)}`, 370, y);
      doc.text(`${quote.currency} ${item.lineTotal.toFixed(2)}`, 470, y, {
        align: 'right',
      });

      y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
  }

  private generateTotalsSection(doc: PDFKit.PDFDocument, quote: Quote): void {
    let y = 500;

    doc.fontSize(10).font('Helvetica');

    doc
      .text('Subtotal:', 370, y)
      .text(`${quote.currency} ${quote.subtotal.toFixed(2)}`, 470, y, {
        align: 'right',
      });
    y += 20;

    if (quote.discountAmount > 0) {
      doc
        .text(`Discount (${quote.discountPercentage}%):`, 370, y)
        .text(`-${quote.currency} ${quote.discountAmount.toFixed(2)}`, 470, y, {
          align: 'right',
        });
      y += 20;
    }

    doc
      .text(`VAT (${(quote.taxRate * 100).toFixed(0)}%):`, 370, y)
      .text(`${quote.currency} ${quote.taxAmount.toFixed(2)}`, 470, y, {
        align: 'right',
      });
    y += 20;

    doc.moveTo(370, y).lineTo(550, y).stroke();
    y += 10;

    doc.fontSize(12).font('Helvetica-Bold');
    doc
      .text('TOTAL:', 370, y)
      .text(`${quote.currency} ${quote.grandTotal.toFixed(2)}`, 470, y, {
        align: 'right',
      });
  }

  private generateFooter(
    doc: PDFKit.PDFDocument,
    quote: Quote,
    companyDetails?: any,
  ): void {
    const footerY = 700;

    doc.fontSize(10).font('Helvetica-Bold').text('TERMS & CONDITIONS:', 50, footerY);
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(
        'Payment Terms: ' + quote.paymentTerms,
        50,
        footerY + 20,
      );
    doc.text(
      'Delivery Estimate: ' + quote.deliveryEstimate,
      50,
      footerY + 35,
    );

    const validUntilDate = new Date(quote.validUntil);
    doc.text(
      `This quote is valid until ${validUntilDate.toLocaleDateString('ro-RO')}`,
      50,
      footerY + 50,
    );

    if (quote.notes) {
      doc
        .fontSize(9)
        .text('Notes: ' + quote.notes, 50, footerY + 65, { width: 400 });
    }

    doc.moveTo(50, footerY - 10).lineTo(550, footerY - 10).stroke();
    doc
      .fontSize(8)
      .text(
        'Thank you for your business!',
        50,
        750,
        { align: 'center', width: 500 },
      );
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
