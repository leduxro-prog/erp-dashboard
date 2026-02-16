/**
 * Email Templates for Quotations
 */

export interface QuoteEmailData {
  quoteNumber: string;
  customerName: string;
  quoteDate: string;
  expiryDate: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  notes?: string;
  termsAndConditions?: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  viewQuoteUrl: string;
}

export class QuoteEmailTemplates {
  /**
   * Email template when quote is sent to customer
   */
  static quoteSent(data: QuoteEmailData): { subject: string; html: string; text: string } {
    const subject = `Ofertă ${data.quoteNumber} - ${data.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px 20px; }
    .quote-details { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .quote-number { font-size: 18px; font-weight: bold; color: #667eea; }
    .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .items-table th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
    .items-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .totals { margin-top: 20px; text-align: right; }
    .totals div { padding: 8px 0; }
    .total-row { font-size: 20px; font-weight: bold; color: #667eea; padding-top: 12px; border-top: 2px solid #e5e7eb; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .cta-button:hover { background: #5568d3; }
    .footer { background: #1f2937; color: #9ca3af; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 14px; }
    .notes { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Ofertă Nouă</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Mulțumim pentru interes! Vă prezentăm oferta solicitată.</p>
    </div>

    <div class="content">
      <p>Bună ziua <strong>${data.customerName}</strong>,</p>
      <p>Vă transmitem oferta de preț conform discuției noastre:</p>

      <div class="quote-details">
        <div class="quote-number">Oferta #${data.quoteNumber}</div>
        <div style="margin-top: 10px; color: #6b7280;">
          <div><strong>Data:</strong> ${new Date(data.quoteDate).toLocaleDateString('ro-RO')}</div>
          <div><strong>Valabilă până:</strong> ${new Date(data.expiryDate).toLocaleDateString('ro-RO')}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Produs</th>
              <th style="text-align: center;">Cantitate</th>
              <th style="text-align: right;">Preț Unitar</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>${item.productName}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${item.unitPrice.toFixed(2)} ${data.currencyCode}</td>
                <td style="text-align: right;"><strong>${item.total.toFixed(2)} ${data.currencyCode}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div>Subtotal: <strong>${data.subtotal.toFixed(2)} ${data.currencyCode}</strong></div>
          ${data.discountAmount > 0 ? `<div style="color: #10b981;">Discount: -${data.discountAmount.toFixed(2)} ${data.currencyCode}</div>` : ''}
          <div>TVA: <strong>${data.taxAmount.toFixed(2)} ${data.currencyCode}</strong></div>
          <div class="total-row">TOTAL: ${data.totalAmount.toFixed(2)} ${data.currencyCode}</div>
        </div>
      </div>

      ${data.notes ? `
        <div class="notes">
          <strong>📝 Notițe:</strong><br>
          ${data.notes.replace(/\n/g, '<br>')}
        </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${data.viewQuoteUrl}" class="cta-button">📄 Vezi Oferta Completă</a>
      </div>

      <p style="margin-top: 30px;">Pentru orice întrebări sau clarificări, nu ezitați să ne contactați:</p>
      <p>
        📧 Email: <a href="mailto:${data.companyEmail}">${data.companyEmail}</a><br>
        📞 Telefon: <a href="tel:${data.companyPhone}">${data.companyPhone}</a>
      </p>

      ${data.termsAndConditions ? `
        <div style="margin-top: 30px; padding: 15px; background: white; border-radius: 6px; font-size: 12px; color: #6b7280;">
          <strong>Termeni și Condiții:</strong><br>
          ${data.termsAndConditions.replace(/\n/g, '<br>')}
        </div>
      ` : ''}
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;"><strong>${data.companyName}</strong></p>
      <p style="margin: 0;">Acest email a fost generat automat de sistemul CYPHER ERP.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
Oferta #${data.quoteNumber}

Bună ziua ${data.customerName},

Vă transmitem oferta de preț conform discuției noastre.

Data: ${new Date(data.quoteDate).toLocaleDateString('ro-RO')}
Valabilă până: ${new Date(data.expiryDate).toLocaleDateString('ro-RO')}

PRODUSE:
${data.items.map(item => `
- ${item.productName}
  Cantitate: ${item.quantity} x ${item.unitPrice.toFixed(2)} ${data.currencyCode}
  Total: ${item.total.toFixed(2)} ${data.currencyCode}
`).join('\n')}

SUMAR:
Subtotal: ${data.subtotal.toFixed(2)} ${data.currencyCode}
${data.discountAmount > 0 ? `Discount: -${data.discountAmount.toFixed(2)} ${data.currencyCode}\n` : ''}TVA: ${data.taxAmount.toFixed(2)} ${data.currencyCode}
TOTAL: ${data.totalAmount.toFixed(2)} ${data.currencyCode}

${data.notes ? `\nNotițe:\n${data.notes}\n` : ''}
Vezi oferta completă: ${data.viewQuoteUrl}

Contact:
Email: ${data.companyEmail}
Telefon: ${data.companyPhone}

${data.termsAndConditions ? `\nTermeni și Condiții:\n${data.termsAndConditions}\n` : ''}
---
${data.companyName}
Acest email a fost generat automat de sistemul CYPHER ERP.
    `.trim();

    return { subject, html, text };
  }

  /**
   * Email reminder for pending quotes
   */
  static quoteReminder(data: QuoteEmailData & { daysUntilExpiry: number }): { subject: string; html: string; text: string } {
    const subject = `Reminder: Oferta ${data.quoteNumber} expiră în ${data.daysUntilExpiry} zile`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .cta-button { display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h2>⏰ Reminder Ofertă</h2>
    <p>Bună ziua <strong>${data.customerName}</strong>,</p>

    <div class="alert">
      <p style="margin: 0; font-size: 16px;"><strong>Oferta #${data.quoteNumber}</strong> va expira în <strong>${data.daysUntilExpiry} zile</strong> (${new Date(data.expiryDate).toLocaleDateString('ro-RO')}).</p>
    </div>

    <p>Valoare ofertă: <strong>${data.totalAmount.toFixed(2)} ${data.currencyCode}</strong></p>

    <p>Pentru a beneficia de această ofertă, vă rugăm să confirmați până la data expirării.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.viewQuoteUrl}" class="cta-button">Vezi Oferta</a>
    </div>

    <p>Pentru orice întrebări: ${data.companyEmail} | ${data.companyPhone}</p>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #6b7280;">${data.companyName}</p>
  </div>
</body>
</html>
    `.trim();

    const text = `
Reminder: Oferta #${data.quoteNumber}

Bună ziua ${data.customerName},

Oferta #${data.quoteNumber} va expira în ${data.daysUntilExpiry} zile (${new Date(data.expiryDate).toLocaleDateString('ro-RO')}).

Valoare ofertă: ${data.totalAmount.toFixed(2)} ${data.currencyCode}

Vezi oferta: ${data.viewQuoteUrl}

Contact: ${data.companyEmail} | ${data.companyPhone}

${data.companyName}
    `.trim();

    return { subject, html, text };
  }

  /**
   * WhatsApp message template for quote
   */
  static whatsAppMessage(data: QuoteEmailData): string {
    return `
🎯 *Ofertă Nouă #${data.quoteNumber}*

Bună ziua *${data.customerName}*,

Vă transmitem oferta de preț solicitată:

📅 Data: ${new Date(data.quoteDate).toLocaleDateString('ro-RO')}
⏰ Valabilă până: ${new Date(data.expiryDate).toLocaleDateString('ro-RO')}

*Produse:*
${data.items.map(item => `• ${item.productName}\n  ${item.quantity} x ${item.unitPrice.toFixed(2)} ${data.currencyCode} = *${item.total.toFixed(2)} ${data.currencyCode}*`).join('\n\n')}

*Sumar:*
Subtotal: ${data.subtotal.toFixed(2)} ${data.currencyCode}
${data.discountAmount > 0 ? `Discount: -${data.discountAmount.toFixed(2)} ${data.currencyCode}\n` : ''}TVA: ${data.taxAmount.toFixed(2)} ${data.currencyCode}
*TOTAL: ${data.totalAmount.toFixed(2)} ${data.currencyCode}*

${data.notes ? `\n📝 ${data.notes}\n` : ''}
🔗 Vezi oferta completă: ${data.viewQuoteUrl}

Pentru orice întrebări:
📧 ${data.companyEmail}
📞 ${data.companyPhone}

_${data.companyName}_
    `.trim();
  }
}
