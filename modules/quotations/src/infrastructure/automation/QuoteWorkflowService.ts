/**
 * Quote Workflow Automation Service
 * Handles automated reminders, follow-ups, and status transitions
 */

import * as cron from 'node-cron';
import { DataSource } from 'typeorm';
import { QuoteAnalyticsService } from '../../application/services/QuoteAnalyticsService';
import { WhatsAppService } from '../notifications/WhatsAppService';
import { QuoteEmailTemplates, QuoteEmailData } from '../templates/EmailTemplates';

export interface WorkflowConfig {
  enableAutomation: boolean;
  reminderDays: number[]; // Days before expiry to send reminders (e.g., [7, 3, 1])
  followUpDays: number; // Days without response to send follow-up
  autoExpireEnabled: boolean; // Automatically mark expired quotes
  notificationChannels: ('email' | 'whatsapp')[]; // Which channels to use
}

export interface WorkflowTask {
  type: 'reminder' | 'follow-up' | 'expire';
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  daysUntilExpiry?: number;
  daysSinceSent?: number;
}

export class QuoteWorkflowService {
  private config: WorkflowConfig;
  private analyticsService: QuoteAnalyticsService;
  private whatsAppService: WhatsAppService;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor(
    private dataSource: DataSource,
    config?: Partial<WorkflowConfig>
  ) {
    this.config = {
      enableAutomation: config?.enableAutomation ?? true,
      reminderDays: config?.reminderDays ?? [7, 3, 1],
      followUpDays: config?.followUpDays ?? 3,
      autoExpireEnabled: config?.autoExpireEnabled ?? true,
      notificationChannels: config?.notificationChannels ?? ['email'],
    };

    this.analyticsService = new QuoteAnalyticsService(dataSource);
    this.whatsAppService = new WhatsAppService();
  }

  /**
   * Start automated workflow tasks
   */
  start(): void {
    if (!this.config.enableAutomation) {
      console.log('Quote workflow automation is disabled');
      return;
    }

    console.log('Starting quote workflow automation...');

    // Check for reminders every day at 9:00 AM
    const reminderJob = cron.schedule('0 9 * * *', async () => {
      await this.processReminders();
    });
    this.cronJobs.push(reminderJob);

    // Check for follow-ups every day at 10:00 AM
    const followUpJob = cron.schedule('0 10 * * *', async () => {
      await this.processFollowUps();
    });
    this.cronJobs.push(followUpJob);

    // Check for expired quotes every day at 1:00 AM
    if (this.config.autoExpireEnabled) {
      const expireJob = cron.schedule('0 1 * * *', async () => {
        await this.processExpiredQuotes();
      });
      this.cronJobs.push(expireJob);
    }

    console.log('Quote workflow automation started successfully');
  }

  /**
   * Stop automated workflow tasks
   */
  stop(): void {
    console.log('Stopping quote workflow automation...');
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];
    console.log('Quote workflow automation stopped');
  }

  /**
   * Process reminder notifications for expiring quotes
   */
  async processReminders(): Promise<void> {
    try {
      console.log('Processing quote reminders...');

      for (const days of this.config.reminderDays) {
        // Get quotes expiring in N days
        const quotes = await this.getQuotesExpiringIn(days);

        for (const quote of quotes) {
          await this.sendReminder(quote, days);
        }

        console.log(`Processed ${quotes.length} reminders for quotes expiring in ${days} days`);
      }
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  }

  /**
   * Process follow-up notifications for quotes without response
   */
  async processFollowUps(): Promise<void> {
    try {
      console.log('Processing quote follow-ups...');

      const quotes = await this.analyticsService.getQuotesNeedingFollowUp(
        this.config.followUpDays
      );

      for (const quote of quotes) {
        await this.sendFollowUp(quote);
      }

      console.log(`Processed ${quotes.length} follow-ups`);
    } catch (error) {
      console.error('Error processing follow-ups:', error);
    }
  }

  /**
   * Process expired quotes and update their status
   */
  async processExpiredQuotes(): Promise<void> {
    try {
      console.log('Processing expired quotes...');

      const query = `
        UPDATE quotations
        SET status = 'expired',
            updated_at = NOW()
        WHERE status IN ('sent', 'viewed')
          AND expiry_date < NOW()
          AND deleted_at IS NULL
        RETURNING id, quote_number
      `;

      const expiredQuotes = await this.dataSource.query(query);

      console.log(`Marked ${expiredQuotes.length} quotes as expired`);
    } catch (error) {
      console.error('Error processing expired quotes:', error);
    }
  }

  /**
   * Send reminder notification for expiring quote
   */
  private async sendReminder(quote: any, daysUntilExpiry: number): Promise<void> {
    try {
      const quoteData = await this.buildQuoteEmailData(quote.id);

      // Email notification
      if (this.config.notificationChannels.includes('email')) {
        const emailTemplate = QuoteEmailTemplates.quoteReminder({
          ...quoteData,
          daysUntilExpiry,
        });

        // Here you would integrate with your email service
        console.log(`Would send reminder email to ${quote.customer_email}`);
        console.log('Subject:', emailTemplate.subject);
      }

      // WhatsApp notification
      if (
        this.config.notificationChannels.includes('whatsapp') &&
        quote.customer_phone
      ) {
        await this.whatsAppService.sendReminderNotification(
          quote.customer_phone,
          quoteData,
          daysUntilExpiry
        );
        console.log(`Sent WhatsApp reminder to ${quote.customer_phone}`);
      }

      // Log the reminder in database
      await this.dataSource.query(
        `INSERT INTO quotation_notifications (quotation_id, type, channel, sent_at, metadata)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          quote.id,
          'reminder',
          this.config.notificationChannels.join(','),
          JSON.stringify({ daysUntilExpiry }),
        ]
      );
    } catch (error) {
      console.error(`Error sending reminder for quote ${quote.quote_number}:`, error);
    }
  }

  /**
   * Send follow-up notification for quote without response
   */
  private async sendFollowUp(quote: any): Promise<void> {
    try {
      const quoteData = await this.buildQuoteEmailData(quote.id);

      const followUpMessage = `
Bună ziua ${quote.customer_name},

Am observat că nu am primit încă un răspuns cu privire la oferta #${quote.quote_number} trimisă cu ${Math.floor(quote.days_since_sent)} zile în urmă.

Dacă aveți întrebări sau nelămuriri, suntem aici să vă ajutăm!

Valoare ofertă: ${quote.total_amount.toFixed(2)} ${quote.currency_code}
Valabilă până: ${new Date(quoteData.expiryDate).toLocaleDateString('ro-RO')}

Pentru orice întrebări:
📧 ${quoteData.companyEmail}
📞 ${quoteData.companyPhone}

Cu stimă,
${quoteData.companyName}
      `.trim();

      // Email notification
      if (this.config.notificationChannels.includes('email')) {
        console.log(`Would send follow-up email to ${quote.customer_email}`);
      }

      // WhatsApp notification
      if (
        this.config.notificationChannels.includes('whatsapp') &&
        quote.customer_phone
      ) {
        await this.whatsAppService.sendCustomMessage(
          quote.customer_phone,
          followUpMessage
        );
        console.log(`Sent WhatsApp follow-up to ${quote.customer_phone}`);
      }

      // Log the follow-up in database
      await this.dataSource.query(
        `INSERT INTO quotation_notifications (quotation_id, type, channel, sent_at, metadata)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          quote.id,
          'follow-up',
          this.config.notificationChannels.join(','),
          JSON.stringify({ daysSinceSent: quote.days_since_sent }),
        ]
      );
    } catch (error) {
      console.error(`Error sending follow-up for quote ${quote.quote_number}:`, error);
    }
  }

  /**
   * Get quotes expiring in exactly N days
   */
  private async getQuotesExpiringIn(days: number): Promise<any[]> {
    const query = `
      SELECT
        q.id,
        q.quote_number,
        q.expiry_date,
        q.total_amount,
        q.currency_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.status IN ('sent', 'viewed')
        AND q.expiry_date::date = (NOW() + INTERVAL '1 day' * $1)::date
        AND q.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM quotation_notifications qn
          WHERE qn.quotation_id = q.id
            AND qn.type = 'reminder'
            AND qn.sent_at::date = NOW()::date
        )
    `;

    return await this.dataSource.query(query, [days]);
  }

  /**
   * Build QuoteEmailData from quote ID
   */
  private async buildQuoteEmailData(quoteId: string): Promise<QuoteEmailData> {
    const query = `
      SELECT
        q.quote_number,
        q.quote_date,
        q.expiry_date,
        q.subtotal,
        q.discount_amount,
        q.tax_amount,
        q.total_amount,
        q.currency_code,
        q.notes,
        q.terms_and_conditions,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.id = $1
    `;

    const [quote] = await this.dataSource.query(query, [quoteId]);

    // Get quote items
    const itemsQuery = `
      SELECT
        p.name as product_name,
        qi.quantity,
        qi.unit_price,
        qi.total_amount as total
      FROM quotation_items qi
      INNER JOIN products p ON p.id = qi.product_id
      WHERE qi.quotation_id = $1
      ORDER BY qi.sort_order ASC
    `;

    const items = await this.dataSource.query(itemsQuery, [quoteId]);

    return {
      quoteNumber: quote.quote_number,
      customerName: quote.customer_name,
      quoteDate: quote.quote_date,
      expiryDate: quote.expiry_date,
      items: items.map((item: any) => ({
        productName: item.product_name,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        total: parseFloat(item.total),
      })),
      subtotal: parseFloat(quote.subtotal),
      discountAmount: parseFloat(quote.discount_amount),
      taxAmount: parseFloat(quote.tax_amount),
      totalAmount: parseFloat(quote.total_amount),
      currencyCode: quote.currency_code,
      notes: quote.notes,
      termsAndConditions: quote.terms_and_conditions,
      companyName: process.env.COMPANY_NAME || 'LEDUX.RO',
      companyEmail: process.env.COMPANY_EMAIL || 'contact@ledux.ro',
      companyPhone: process.env.COMPANY_PHONE || '+40 XXX XXX XXX',
      viewQuoteUrl: `${process.env.APP_URL || 'https://erp.ledux.ro'}/quotations/${quoteId}`,
    };
  }

  /**
   * Manually trigger reminder for a specific quote
   */
  async sendManualReminder(quoteId: string): Promise<void> {
    const query = `
      SELECT
        q.id,
        q.quote_number,
        q.expiry_date,
        q.total_amount,
        q.currency_code,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        EXTRACT(EPOCH FROM (q.expiry_date - NOW())) / 86400 as days_until_expiry
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.id = $1 AND q.deleted_at IS NULL
    `;

    const [quote] = await this.dataSource.query(query, [quoteId]);

    if (!quote) {
      throw new Error('Quote not found');
    }

    const daysUntilExpiry = Math.ceil(quote.days_until_expiry);
    await this.sendReminder(quote, daysUntilExpiry);
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(): Promise<any> {
    const query = `
      SELECT
        type,
        channel,
        COUNT(*) as count,
        MAX(sent_at) as last_sent
      FROM quotation_notifications
      WHERE sent_at >= NOW() - INTERVAL '30 days'
      GROUP BY type, channel
      ORDER BY type, channel
    `;

    return await this.dataSource.query(query);
  }
}
