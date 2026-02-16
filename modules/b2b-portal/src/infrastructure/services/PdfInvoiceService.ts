import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { VAT_RATE } from '@shared/constants';

export interface InvoiceCompanyData {
  name: string;
  cui: string;
  address: string;
  phone: string;
  email: string;
  iban?: string;
  bank?: string;
  capitalSocial?: string;
  nrRegCom?: string;
}

export interface InvoiceCustomerData {
  companyName: string;
  cui: string;
  address: string;
  contactName?: string;
  phone?: string;
}

export interface InvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  unitPriceAfterDiscount: number;
  total: number;
  vatRate: number;
  vatAmount: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  orderNumber: string;
  company: InvoiceCompanyData;
  customer: InvoiceCustomerData;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalBeforeVat: number;
  totalVat: number;
  totalToPay: number;
  paymentTerms: number;
  notes?: string;
}

export class PdfInvoiceService {
  private readonly defaultCompany: InvoiceCompanyData = {
    name: 'LEDUX INTERNATIONAL SRL',
    cui: 'RO35194414',
    address: 'str. Teleorman nr. 16 ap. 1, Cluj-Napoca, Cluj, Romania',
    phone: '+40 752 427 978',
    email: 'ledux.ro@gmail.com',
    iban: 'RO50BTRLRONCRT0123456789',
    bank: 'BANCA TRANSILVANIA',
    capitalSocial: '200 RON',
    nrRegCom: 'J12/1234/2024',
  };

  private readonly vatRate = VAT_RATE;

  async generateInvoicePdf(invoiceData: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (buffer: Buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.addHeader(doc, invoiceData);
        this.addCompanyAndCustomer(doc, invoiceData);
        this.addInvoiceDetails(doc, invoiceData);
        this.addItemsTable(doc, invoiceData);
        this.addTotals(doc, invoiceData);
        this.addFooter(doc, invoiceData);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }

    doc.fontSize(22).font('Helvetica-Bold').text('FACTURĂ', 350, 45, { align: 'right' });

    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Nr. ${data.invoiceNumber}`, 350, 70, { align: 'right' })
      .text(`din ${this.formatDate(data.invoiceDate)}`, 350, 85, { align: 'right' });

    doc.moveTo(50, 110).lineTo(545, 110).stroke('#cccccc');

    doc.moveDown(2);
  }

  private addCompanyAndCustomer(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const startY = 130;

    doc.fontSize(10).font('Helvetica-Bold').text('VÂNZĂTOR (FURNIZOR):', 50, startY);

    doc
      .font('Helvetica')
      .fontSize(9)
      .text(data.company.name, 50, startY + 15)
      .text(`CUI/CIF: ${data.company.cui}`, 50, startY + 28)
      .text(`Adresă: ${data.company.address}`, 50, startY + 41)
      .text(`Tel: ${data.company.phone}`, 50, startY + 54)
      .text(`Email: ${data.company.email}`, 50, startY + 67);

    if (data.company.nrRegCom) {
      doc.text(`Nr. Reg. Com.: ${data.company.nrRegCom}`, 50, startY + 80);
    }

    doc.fontSize(10).font('Helvetica-Bold').text('CUMPĂRĂTOR (CLIENT):', 300, startY);

    doc
      .font('Helvetica')
      .fontSize(9)
      .text(data.customer.companyName, 300, startY + 15)
      .text(`CUI/CIF: ${data.customer.cui}`, 300, startY + 28)
      .text(`Adresă: ${data.customer.address}`, 300, startY + 41);

    if (data.customer.contactName) {
      doc.text(`Contact: ${data.customer.contactName}`, 300, startY + 54);
    }

    if (data.customer.phone) {
      doc.text(`Tel: ${data.customer.phone}`, 300, startY + 67);
    }

    doc.moveDown(4);
  }

  private addInvoiceDetails(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const startY = 260;

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Comanda nr.: ${data.orderNumber}`, 50, startY)
      .text(`Data scadentă: ${this.formatDate(data.dueDate)}`, 300, startY)
      .text(`Termen plată: ${data.paymentTerms} zile`, 50, startY + 15);

    if (data.notes) {
      doc.text(`Note: ${data.notes}`, 50, startY + 30, { width: 450 });
    }

    doc.moveDown(2);
  }

  private addItemsTable(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const tableTop = 310;
    const rowHeight = 25;
    const colWidths = [50, 180, 50, 70, 70, 75];

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');

    doc.rect(50, tableTop, 495, rowHeight).fill('#2c3e50');

    const headers = ['Nr.', 'Denumire produs', 'Cant.', 'Preț unitar', 'Discount', 'Valoare'];
    let xPos = 55;
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop + 8, { width: colWidths[i] - 5, align: 'left' });
      xPos += colWidths[i];
    });

    doc.fillColor('#000000').font('Helvetica').fontSize(8);

    data.items.forEach((item, index) => {
      const y = tableTop + rowHeight + index * rowHeight;

      if (index % 2 === 0) {
        doc.rect(50, y, 495, rowHeight).fill('#f8f9fa');
        doc.fillColor('#000000');
      }

      xPos = 55;
      doc.text(String(index + 1), xPos, y + 8, { width: colWidths[0] - 5 });
      xPos += colWidths[0];

      doc.text(item.name, xPos, y + 8, { width: colWidths[1] - 5 });
      xPos += colWidths[1];

      doc.text(String(item.quantity), xPos, y + 8, { width: colWidths[2] - 5, align: 'center' });
      xPos += colWidths[2];

      doc.text(this.formatCurrency(item.unitPriceAfterDiscount), xPos, y + 8, {
        width: colWidths[3] - 5,
        align: 'right',
      });
      xPos += colWidths[3];

      doc.text(item.discount > 0 ? `${(item.discount * 100).toFixed(0)}%` : '-', xPos, y + 8, {
        width: colWidths[4] - 5,
        align: 'center',
      });
      xPos += colWidths[4];

      doc.text(this.formatCurrency(item.total), xPos, y + 8, {
        width: colWidths[5] - 5,
        align: 'right',
      });
    });

    const tableBottom = tableTop + rowHeight + data.items.length * rowHeight;

    doc.moveTo(50, tableBottom).lineTo(545, tableBottom).stroke('#cccccc');
  }

  private addTotals(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const startY = 330 + data.items.length * 25 + 20;

    doc.fontSize(9).font('Helvetica');

    const totalsX = 350;

    doc
      .text('Subtotal (fără TVA):', totalsX, startY, { width: 120, align: 'left' })
      .text(this.formatCurrency(data.subtotal), 470, startY, { width: 75, align: 'right' });

    if (data.totalDiscount > 0) {
      doc
        .fillColor('#27ae60')
        .text(`Discount:`, totalsX, startY + 15, { width: 120, align: 'left' })
        .text(`-${this.formatCurrency(data.totalDiscount)}`, 470, startY + 15, {
          width: 75,
          align: 'right',
        })
        .fillColor('#000000');
    }

    doc
      .text('Total înainte de TVA:', totalsX, startY + 30, { width: 120, align: 'left' })
      .text(this.formatCurrency(data.totalBeforeVat), 470, startY + 30, {
        width: 75,
        align: 'right',
      });

    doc
      .fontSize(9)
      .text(`TVA (${VAT_RATE * 100}%):`, totalsX, startY + 45, { width: 120, align: 'left' })
      .text(this.formatCurrency(data.totalVat), 470, startY + 45, { width: 75, align: 'right' });

    doc
      .moveTo(350, startY + 60)
      .lineTo(545, startY + 60)
      .stroke('#2c3e50');

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('TOTAL DE PLATĂ:', totalsX, startY + 65, { width: 120, align: 'left' })
      .text(this.formatCurrency(data.totalToPay), 470, startY + 65, { width: 75, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(8)
      .text('(TVA inclus)', totalsX, startY + 80, { width: 120, align: 'left' });
  }

  private addFooter(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const footerY = 700;

    doc.fontSize(8).font('Helvetica-Bold').text('DATE BANCARE:', 50, footerY);

    doc
      .font('Helvetica')
      .text(`IBAN: ${data.company.iban || 'N/A'}`, 50, footerY + 12)
      .text(`Banca: ${data.company.bank || 'N/A'}`, 50, footerY + 24);

    doc
      .fontSize(7)
      .font('Helvetica-Oblique')
      .text(
        'Factura este valabilă fără semnătură și ștampilă conform OUG nr. 28/1999.',
        50,
        footerY + 50,
        { width: 495, align: 'center' },
      );

    doc
      .fontSize(6)
      .fillColor('#888888')
      .text(
        `Document generat electronic de ${data.company.name} | CUI: ${data.company.cui}`,
        50,
        footerY + 70,
        { width: 495, align: 'center' },
      );
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  getCompanyData(): InvoiceCompanyData {
    return this.defaultCompany;
  }
}
