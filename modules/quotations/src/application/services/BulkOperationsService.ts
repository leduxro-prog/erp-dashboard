/**
 * Bulk Operations Service
 * Perform actions on multiple quotes at once
 */

import { DataSource } from 'typeorm';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WhatsAppService } from '../../infrastructure/notifications/WhatsAppService';
import { SmsService } from '../../infrastructure/notifications/SmsService';

export interface BulkOperationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{
    quoteId: string;
    quoteNumber: string;
    error: string;
  }>;
  results: Array<{
    quoteId: string;
    quoteNumber: string;
    success: boolean;
    message?: string;
  }>;
}

export interface BulkSendOptions {
  quoteIds: string[];
  channels: ('email' | 'whatsapp' | 'sms')[];
  customMessage?: string;
  scheduleAt?: Date;
}

export interface BulkUpdateOptions {
  quoteIds: string[];
  updates: {
    expiryDate?: Date;
    status?: string;
    discountPercentage?: number;
    notes?: string;
  };
}

export class BulkOperationsService {
  private emailService: EmailService;
  private whatsappService: WhatsAppService;
  private smsService: SmsService;

  constructor(
    private dataSource: DataSource,
    emailService?: EmailService,
    whatsappService?: WhatsAppService,
    smsService?: SmsService
  ) {
    this.emailService = emailService || new EmailService();
    this.whatsappService = whatsappService || new WhatsAppService();
    this.smsService = smsService || new SmsService();
  }

  /**
   * Bulk send quotes to customers
   */
  async bulkSendQuotes(options: BulkSendOptions): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      results: [],
    };

    // Fetch quotes
    const quotes = await this.fetchQuotes(options.quoteIds);

    if (quotes.length === 0) {
      throw new Error('No valid quotes found');
    }

    // Process each quote
    for (const quote of quotes) {
      result.totalProcessed++;

      try {
        // Send via requested channels
        const sendResults = await Promise.allSettled(
          options.channels.map(channel => {
            switch (channel) {
              case 'email':
                return this.sendQuoteViaEmail(quote);
              case 'whatsapp':
                return this.sendQuoteViaWhatsApp(quote);
              case 'sms':
                return this.sendQuoteViaSms(quote);
              default:
                return Promise.resolve({ success: false });
            }
          })
        );

        // Check if at least one channel succeeded
        const anySuccess = sendResults.some(
          r => r.status === 'fulfilled' && (r.value as any).success
        );

        if (anySuccess) {
          result.successful++;
          result.results.push({
            quoteId: quote.id,
            quoteNumber: quote.quote_number,
            success: true,
            message: `Sent via ${options.channels.join(', ')}`,
          });

          // Update quote status
          await this.dataSource.query(
            `UPDATE quotations SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [quote.id]
          );
        } else {
          result.failed++;
          result.errors.push({
            quoteId: quote.id,
            quoteNumber: quote.quote_number,
            error: 'Failed to send via all channels',
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk update quotes
   */
  async bulkUpdateQuotes(options: BulkUpdateOptions): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      results: [],
    };

    // Build update query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.updates.expiryDate) {
      setClauses.push(`expiry_date = $${paramIndex}`);
      values.push(options.updates.expiryDate);
      paramIndex++;
    }

    if (options.updates.status) {
      setClauses.push(`status = $${paramIndex}`);
      values.push(options.updates.status);
      paramIndex++;
    }

    if (options.updates.discountPercentage !== undefined) {
      setClauses.push(`discount_percentage = $${paramIndex}`);
      values.push(options.updates.discountPercentage);
      paramIndex++;

      // Recalculate discount amount
      setClauses.push(`discount_amount = subtotal * $${paramIndex - 1} / 100`);
      setClauses.push(`total_amount = subtotal - discount_amount + tax_amount`);
    }

    if (options.updates.notes) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(options.updates.notes);
      paramIndex++;
    }

    setClauses.push('updated_at = NOW()');

    values.push(options.quoteIds);

    const query = `
      UPDATE quotations
      SET ${setClauses.join(', ')}
      WHERE id = ANY($${paramIndex})
        AND deleted_at IS NULL
      RETURNING id, quote_number
    `;

    try {
      const updated = await this.dataSource.query(query, values);

      result.totalProcessed = updated.length;
      result.successful = updated.length;

      updated.forEach((quote: any) => {
        result.results.push({
          quoteId: quote.id,
          quoteNumber: quote.quote_number,
          success: true,
          message: 'Updated successfully',
        });
      });

      // Check for quotes that weren't found
      const updatedIds = updated.map((q: any) => q.id);
      const notFound = options.quoteIds.filter(id => !updatedIds.includes(id));

      notFound.forEach(id => {
        result.totalProcessed++;
        result.failed++;
        result.errors.push({
          quoteId: id,
          quoteNumber: 'Unknown',
          error: 'Quote not found or already deleted',
        });
      });
    } catch (error) {
      result.failed = options.quoteIds.length;
      result.errors.push({
        quoteId: 'all',
        quoteNumber: 'all',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Bulk expire quotes
   */
  async bulkExpireQuotes(quoteIds: string[]): Promise<BulkOperationResult> {
    return await this.bulkUpdateQuotes({
      quoteIds,
      updates: { status: 'expired' },
    });
  }

  /**
   * Bulk extend expiry date
   */
  async bulkExtendExpiry(quoteIds: string[], daysToExtend: number): Promise<BulkOperationResult> {
    const query = `
      UPDATE quotations
      SET
        expiry_date = expiry_date + INTERVAL '${daysToExtend} days',
        updated_at = NOW()
      WHERE id = ANY($1)
        AND deleted_at IS NULL
        AND status IN ('sent', 'viewed')
      RETURNING id, quote_number
    `;

    try {
      const updated = await this.dataSource.query(query, [quoteIds]);

      const result: BulkOperationResult = {
        totalProcessed: updated.length,
        successful: updated.length,
        failed: 0,
        errors: [],
        results: updated.map((q: any) => ({
          quoteId: q.id,
          quoteNumber: q.quote_number,
          success: true,
          message: `Extended by ${daysToExtend} days`,
        })),
      };

      return result;
    } catch (error) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: quoteIds.length,
        errors: [{
          quoteId: 'all',
          quoteNumber: 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        results: [],
      };
    }
  }

  /**
   * Bulk delete quotes (soft delete)
   */
  async bulkDeleteQuotes(quoteIds: string[]): Promise<BulkOperationResult> {
    const query = `
      UPDATE quotations
      SET deleted_at = NOW()
      WHERE id = ANY($1)
        AND deleted_at IS NULL
      RETURNING id, quote_number
    `;

    try {
      const deleted = await this.dataSource.query(query, [quoteIds]);

      return {
        totalProcessed: deleted.length,
        successful: deleted.length,
        failed: 0,
        errors: [],
        results: deleted.map((q: any) => ({
          quoteId: q.id,
          quoteNumber: q.quote_number,
          success: true,
          message: 'Deleted successfully',
        })),
      };
    } catch (error) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: quoteIds.length,
        errors: [{
          quoteId: 'all',
          quoteNumber: 'all',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        results: [],
      };
    }
  }

  /**
   * Bulk apply discount
   */
  async bulkApplyDiscount(quoteIds: string[], discountPercentage: number): Promise<BulkOperationResult> {
    return await this.bulkUpdateQuotes({
      quoteIds,
      updates: { discountPercentage },
    });
  }

  /**
   * Fetch quotes for bulk operations
   */
  private async fetchQuotes(quoteIds: string[]): Promise<any[]> {
    const query = `
      SELECT
        q.id,
        q.quote_number,
        q.customer_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM quotations q
      INNER JOIN customers c ON c.id = q.customer_id
      WHERE q.id = ANY($1)
        AND q.deleted_at IS NULL
    `;

    return await this.dataSource.query(query, [quoteIds]);
  }

  /**
   * Send quote via email (placeholder)
   */
  private async sendQuoteViaEmail(quote: any): Promise<{ success: boolean }> {
    // TODO: Implement full email sending with template
    console.log(`Sending quote ${quote.quote_number} via email to ${quote.customer_email}`);
    return { success: true };
  }

  /**
   * Send quote via WhatsApp (placeholder)
   */
  private async sendQuoteViaWhatsApp(quote: any): Promise<{ success: boolean }> {
    console.log(`Sending quote ${quote.quote_number} via WhatsApp to ${quote.customer_phone}`);
    return { success: true };
  }

  /**
   * Send quote via SMS (placeholder)
   */
  private async sendQuoteViaSms(quote: any): Promise<{ success: boolean }> {
    console.log(`Sending quote ${quote.quote_number} via SMS to ${quote.customer_phone}`);
    return { success: true };
  }

  /**
   * Get bulk operation statistics
   */
  async getBulkOperationStats(days: number = 30): Promise<any> {
    // TODO: Implement logging of bulk operations and retrieve stats
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
    };
  }
}
