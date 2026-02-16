/**
 * CreateProformaFromQuote Use Case
 *
 * Creates a SmartBill proforma directly from a quotation.
 * Fetches the quote from DB, extracts customer/items data,
 * sends to SmartBill API, and saves the result.
 *
 * Idempotency: prevents duplicate proformas for the same quote.
 */

import { DataSource } from 'typeorm';
import { SmartBillProforma, InvoiceItem } from '../../domain/entities';
import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { ProformaCreationError } from '../errors/smartbill.errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('CreateProformaFromQuote');

export interface CreateProformaFromQuoteDto {
  quoteId: number;
  series?: string;
  dueInDays?: number;
}

export interface ProformaFromQuoteResultDto {
  id: number;
  quoteId: number;
  smartBillId: string;
  proformaNumber: string;
  series: string;
  customerName: string;
  customerVat: string;
  totalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  currency: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  createdAt: Date;
  items: InvoiceItem[];
}

export interface ISmartBillApiClientForQuoteProforma {
  createProforma(payload: any): Promise<{ id: string; number: string; status: string }>;
}

export interface IEventBusForQuoteProforma {
  publish(eventName: string, data: any): Promise<void>;
}

export class CreateProformaFromQuoteUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientForQuoteProforma,
    private readonly eventBus: IEventBusForQuoteProforma,
    private readonly dataSource: DataSource,
  ) {}

  async execute(dto: CreateProformaFromQuoteDto): Promise<ProformaFromQuoteResultDto> {
    const { quoteId, series = 'PF', dueInDays = 30 } = dto;

    try {
      // 1. Deterministic synthetic order ID for quote-based proformas
      const syntheticOrderId = `QUOTE-${quoteId}`;

      // 2. Idempotency check — don't create duplicate proforma for same quote
      const existing = await this.dataSource.query(
        `SELECT id, "smartBillId", "proformaNumber", status
         FROM smartbill_proformas
         WHERE "orderId"::text = $1 AND status != 'cancelled'
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        [syntheticOrderId],
      );

      if (existing.length > 0) {
        throw new ProformaCreationError(
          `A proforma already exists for quote #${quoteId} (proforma #${existing[0].proformaNumber || existing[0].id})`,
          String(quoteId),
        );
      }

      // 3. Fetch quote from DB
      const quoteRows = await this.dataSource.query(
        `SELECT q.id, q.quote_number, q.customer_id, q.status,
                q.subtotal, q.discount_amount, q.discount_percentage,
                q.tax_amount, q.total_amount, q.currency_code,
                q.expiry_date, q.notes, q.metadata
         FROM quotes q
         WHERE q.id = $1`,
        [quoteId],
      );

      if (quoteRows.length === 0) {
        throw new ProformaCreationError(`Quote #${quoteId} not found`, String(quoteId));
      }

      const quote = quoteRows[0];

      // Only allow proforma from non-expired, non-rejected quotes
      const allowedStatuses = ['draft', 'sent', 'viewed', 'accepted', 'converted'];
      if (!allowedStatuses.includes(quote.status)) {
        throw new ProformaCreationError(
          `Cannot create proforma for quote with status "${quote.status}"`,
          String(quoteId),
        );
      }

      // 4. Parse metadata (items, customerName, taxRate are stored here)
      const metadata =
        typeof quote.metadata === 'string' ? JSON.parse(quote.metadata) : quote.metadata || {};

      const customerName: string = metadata.customerName || '';
      const taxRate: number = metadata.taxRate ?? 0.21;
      const quoteItems: Array<{
        productId?: number;
        sku: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = metadata.items || [];

      if (quoteItems.length === 0) {
        throw new ProformaCreationError(`Quote #${quoteId} has no line items`, String(quoteId));
      }

      // 5. Fetch customer CUI/VAT from customers table
      let customerVat = '';
      if (quote.customer_id) {
        const customerRows = await this.dataSource.query(
          `SELECT tax_identification_number FROM customers WHERE id = $1`,
          [quote.customer_id],
        );
        if (customerRows.length > 0) {
          customerVat = customerRows[0].tax_identification_number || '';
        }
      }

      // 6. Build SmartBill proforma items
      const items: InvoiceItem[] = quoteItems.map((item) => {
        const totalWithoutVat = item.quantity * item.unitPrice;
        const vatAmount = SmartBillProforma.calculateVat(totalWithoutVat, taxRate);
        return {
          productName: item.productName,
          sku: item.sku || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: taxRate,
          totalWithoutVat,
          vatAmount,
        };
      });

      // 7. Calculate dates and totals
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueInDays);
      const currency = quote.currency_code || 'RON';
      const totalWithoutVat = items.reduce((sum, item) => sum + item.totalWithoutVat, 0);
      const vatAmount = items.reduce((sum, item) => sum + item.vatAmount, 0);

      // 8. Create domain proforma
      const proforma = new SmartBillProforma(
        undefined,
        syntheticOrderId,
        undefined,
        undefined,
        series,
        customerName,
        customerVat,
        items,
        totalWithoutVat,
        vatAmount,
        totalWithoutVat + vatAmount,
        currency,
        'draft',
        issueDate,
        dueDate,
      );

      // 9. Build SmartBill API payload
      const apiPayload = {
        companyName: customerName,
        companyVat: customerVat,
        proformaSeries: series,
        issueDate: issueDate.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        currency,
        items: items.map((item) => ({
          name: item.productName,
          measuringUnit: 'buc',
          quantity: item.quantity,
          price: item.unitPrice,
          vat: item.vatRate * 100,
          vatAmount: item.vatAmount,
        })),
      };

      logger.info('Creating SmartBill proforma from quote', {
        quoteId,
        quoteNumber: quote.quote_number,
        customerName,
        totalItems: items.length,
      });

      // 10. Call SmartBill API
      const apiResponse = await this.apiClient.createProforma(apiPayload);

      // 11. Mark proforma as issued
      proforma.markIssued(apiResponse.id, apiResponse.number, apiResponse.status as any);

      // 12. Save to DB via repository
      const savedProforma = await this.repository.saveProforma(proforma);

      // 13. Try to save quote reference when DB schema supports it
      await this.persistQuoteReference(quoteId, savedProforma.id!);

      // 14. Publish event
      await this.eventBus.publish('smartbill.proforma_from_quote_created', {
        proformaId: savedProforma.id,
        quoteId,
        quoteNumber: quote.quote_number,
        smartBillId: savedProforma.smartBillId,
        proformaNumber: savedProforma.proformaNumber,
        totalWithVat: savedProforma.totalWithVat,
        customerName,
        customerVat,
        status: apiResponse.status || 'sent',
      });

      logger.info('SmartBill proforma created from quote', {
        proformaId: savedProforma.id,
        quoteId,
        smartBillId: savedProforma.smartBillId,
        proformaNumber: savedProforma.proformaNumber,
      });

      return {
        id: savedProforma.id!,
        quoteId,
        smartBillId: savedProforma.smartBillId!,
        proformaNumber: savedProforma.proformaNumber!,
        series: savedProforma.series,
        customerName: savedProforma.customerName,
        customerVat: savedProforma.customerVat,
        totalWithoutVat: savedProforma.totalWithoutVat,
        vatAmount: savedProforma.vatAmount,
        totalWithVat: savedProforma.totalWithVat,
        currency: savedProforma.currency,
        status: savedProforma.status,
        issueDate: savedProforma.issueDate,
        dueDate: savedProforma.dueDate,
        createdAt: savedProforma.createdAt,
        items: savedProforma.items,
      };
    } catch (error) {
      // Publish failure event
      await this.eventBus
        .publish('smartbill.proforma_from_quote_failed', {
          quoteId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          // Ignore event bus errors
        });

      if (error instanceof ProformaCreationError) {
        throw error;
      }
      throw new ProformaCreationError(
        `Failed to create proforma from quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        String(quoteId),
      );
    }
  }

  private async persistQuoteReference(quoteId: number, proformaId: number): Promise<void> {
    try {
      await this.dataSource.query(`UPDATE smartbill_proformas SET "quoteId" = $1 WHERE id = $2`, [
        quoteId,
        proformaId,
      ]);
      return;
    } catch {
      // Fallback for legacy column naming
    }

    try {
      await this.dataSource.query(`UPDATE smartbill_proformas SET quote_id = $1 WHERE id = $2`, [
        quoteId,
        proformaId,
      ]);
    } catch (error) {
      logger.warn('Quote reference column not available in smartbill_proformas', {
        quoteId,
        proformaId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
