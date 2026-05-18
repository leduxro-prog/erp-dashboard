import PDFDocument from 'pdfkit';

export class CatalogPdfGenerator {
  async generateProductDatasheet(
    product: any,
    logoUrl?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          bufferPages: true,
          margin: 50,
          size: 'A4',
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // --- Header Section ---
        this.generateHeader(doc, logoUrl);
        
        // --- Product Info Section ---
        this.generateProductInfo(doc, product);
        
        // --- Specs Section ---
        this.generateSpecsGrid(doc, product.specs);
        
        // --- Footer ---
        this.generateFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private generateHeader(doc: PDFKit.PDFDocument, logoUrl?: string): void {
    if (logoUrl) {
      // doc.image(logoUrl, 50, 45, { width: 100 });
    }
    
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('FIȘĂ TEHNICĂ PRODUS', 200, 50, { align: 'right' });
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('LEDUX PROFESSIONAL LIGHTING', 50, 50)
      .text('www.ledux.ro | info@ledux.ro', 50, 65);

    doc.moveTo(50, 90).lineTo(550, 90).stroke('#eeeeee');
  }

  private generateProductInfo(doc: PDFKit.PDFDocument, product: any): void {
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#0f172a')
      .text(product.name, 50, 110, { width: 500 });

    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`Cod SKU: ${product.sku}`, 50, 145);

    if (product.category?.name) {
      doc.text(`Categorie: ${product.category.name}`, 350, 145, { align: 'right' });
    }

    doc.moveTo(50, 170).lineTo(550, 170).stroke('#f1f5f9');

    // Description
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('DESCRIERE PRODUS', 50, 190);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#334155')
      .text(product.description || 'Nicio descriere disponibilă.', 50, 210, {
        width: 500,
        lineGap: 4,
        align: 'justify'
      });
  }

  private generateSpecsGrid(doc: PDFKit.PDFDocument, specs: any): void {
    if (!specs) return;

    const startY = 320;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text('SPECIFICAȚII TEHNICE', 50, startY);

    const specItems = [
      { label: 'Putere (W)', value: specs.wattage || '—' },
      { label: 'Flux Luminos (lm)', value: specs.lumens || '—' },
      { label: 'Temperatură Culoare (K)', value: specs.color_temperature || '—' },
      { label: 'Indice Redare Culori (CRI)', value: specs.cri || '>80' },
      { label: 'Grad Protecție (IP)', value: specs.ip_rating || 'IP20' },
      { label: 'Tensiune Alimentare', value: specs.voltage || '220-240V AC' },
      { label: 'Dimmabil', value: specs.dimmable ? 'DA' : 'NU' },
      { label: 'Garanție (ani)', value: specs.warranty_years || '3' },
      { label: 'Brand', value: specs.brand || 'LEDUX' },
      { label: 'Certificări', value: 'CE, RoHS' }
    ];

    let currentY = startY + 25;
    
    // Draw table-like grid
    specItems.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.rect(50, currentY - 5, 500, 25).fill('#f8fafc');
      }

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text(item.label, 65, currentY);

      doc
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(item.value.toString(), 300, currentY);

      currentY += 25;
    });
  }

  private generateFooter(doc: PDFKit.PDFDocument): void {
    const footerY = 780;
    doc.moveTo(50, footerY).lineTo(550, footerY).stroke('#f1f5f9');
    
    doc
      .fontSize(8)
      .fillColor('#94a3b8')
      .text(
        'Informațiile din această fișă pot fi modificate fără preaviz. Imaginile sunt cu titlu de prezentare.',
        50,
        footerY + 10,
        { align: 'center', width: 500 }
      );
  }
}
