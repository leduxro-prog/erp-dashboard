/**
 * WhatsApp Notification Service for Quotations
 * Integrates with WhatsApp Business API for automated notifications
 */

import axios from 'axios';
import { QuoteEmailData } from '../templates/EmailTemplates';

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  phoneNumberId: string;
  businessAccountId: string;
}

export interface WhatsAppMessage {
  to: string; // Phone number in international format (e.g., +40712345678)
  message: string;
  mediaUrl?: string; // Optional: URL to PDF or image
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppService {
  private config: WhatsAppConfig;

  constructor(config?: WhatsAppConfig) {
    // Use environment variables or provided config
    this.config = config || {
      apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
      apiKey: process.env.WHATSAPP_API_KEY || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    };
  }

  /**
   * Send quote notification via WhatsApp
   */
  async sendQuoteNotification(
    phoneNumber: string,
    quoteData: QuoteEmailData,
    pdfUrl?: string
  ): Promise<WhatsAppSendResult> {
    try {
      // Format the message using the template
      const message = this.formatQuoteMessage(quoteData);

      // Send text message
      const result = await this.sendMessage({
        to: this.formatPhoneNumber(phoneNumber),
        message,
        mediaUrl: pdfUrl,
      });

      return result;
    } catch (error: any) {
      console.error('Failed to send WhatsApp notification:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Send reminder notification via WhatsApp
   */
  async sendReminderNotification(
    phoneNumber: string,
    quoteData: QuoteEmailData,
    daysUntilExpiry: number
  ): Promise<WhatsAppSendResult> {
    try {
      const message = this.formatReminderMessage(quoteData, daysUntilExpiry);

      const result = await this.sendMessage({
        to: this.formatPhoneNumber(phoneNumber),
        message,
      });

      return result;
    } catch (error: any) {
      console.error('Failed to send WhatsApp reminder:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Send custom message via WhatsApp
   */
  async sendCustomMessage(
    phoneNumber: string,
    message: string,
    mediaUrl?: string
  ): Promise<WhatsAppSendResult> {
    try {
      const result = await this.sendMessage({
        to: this.formatPhoneNumber(phoneNumber),
        message,
        mediaUrl,
      });

      return result;
    } catch (error: any) {
      console.error('Failed to send WhatsApp message:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Send message via WhatsApp Business API
   */
  private async sendMessage(data: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      // Check if API is configured
      if (!this.config.apiKey || !this.config.phoneNumberId) {
        console.warn('WhatsApp API not configured. Message would be sent to:', data.to);
        // In development, just log the message
        console.log('WhatsApp Message:', data.message);
        return {
          success: true,
          messageId: `dev-${Date.now()}`,
        };
      }

      // Prepare the request payload
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: data.to,
        type: 'text',
        text: {
          preview_url: true,
          body: data.message,
        },
      };

      // If media URL is provided, send as document
      if (data.mediaUrl) {
        payload.type = 'document';
        payload.document = {
          link: data.mediaUrl,
          caption: 'Oferta PDF',
          filename: `Oferta_${Date.now()}.pdf`,
        };
      }

      // Send via WhatsApp Business API
      const response = await axios.post(
        `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error: any) {
      console.error('WhatsApp API error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Format quote message for WhatsApp
   */
  private formatQuoteMessage(data: QuoteEmailData): string {
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

  /**
   * Format reminder message for WhatsApp
   */
  private formatReminderMessage(data: QuoteEmailData, daysUntilExpiry: number): string {
    return `
⏰ *Reminder: Oferta ${data.quoteNumber}*

Bună ziua *${data.customerName}*,

Vă reamintim că oferta *#${data.quoteNumber}* va expira în *${daysUntilExpiry} zile* (${new Date(data.expiryDate).toLocaleDateString('ro-RO')}).

💰 Valoare ofertă: *${data.totalAmount.toFixed(2)} ${data.currencyCode}*

Pentru a beneficia de această ofertă, vă rugăm să confirmați până la data expirării.

🔗 Vezi oferta: ${data.viewQuoteUrl}

Contact: ${data.companyEmail} | ${data.companyPhone}

_${data.companyName}_
    `.trim();
  }

  /**
   * Format phone number to international format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove spaces, dashes, and other non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add +40 prefix if Romanian number without country code
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      cleaned = '40' + cleaned.substring(1);
    }

    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Check if it's a valid international format (+ followed by 10-15 digits)
    return /^\+\d{10,15}$/.test(formatted);
  }
}
