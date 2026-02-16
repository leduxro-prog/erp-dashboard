import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { SmartBillInvoice, InvoiceStatus } from '../../domain/entities/SmartBillInvoice';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill');

export interface ISmartBillApiClientSync {
  getPaymentStatus(smartBillId: string): Promise<{
    status: string;
    paidAmount: number;
    totalAmount: number;
    paymentDate: Date | null;
  }>;
}

export interface IEventBusSync {
  publish(eventName: string, data: any): Promise<void>;
}

export interface IOrderServiceSync {
  updateOrderWithSmartBillId(params: {
    orderId: string;
    smartBillInvoiceId?: string;
    invoiceNumber?: string;
    invoiceSeries?: string;
    status?: string;
  }): Promise<{ success: boolean; orderNumber: string; message?: string }>;
}

export interface InvoiceStatusSyncDetail {
  invoiceId: number;
  oldStatus: InvoiceStatus;
  newStatus: string;
}

export interface InvoiceStatusSyncResult {
  checked: number;
  updated: number;
  errors: number;
  details: InvoiceStatusSyncDetail[];
}

const BATCH_SIZE = 10;
const DELAY_BETWEEN_CALLS_MS = 500;

export class SyncInvoiceStatusUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientSync,
    private readonly eventBus: IEventBusSync,
    private readonly orderService: IOrderServiceSync,
  ) {}

  async execute(): Promise<InvoiceStatusSyncResult> {
    const result: InvoiceStatusSyncResult = {
      checked: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    try {
      // 1. Query all non-paid, non-cancelled invoices with a smartBillId
      const draftInvoices = await this.repository.getInvoicesByStatus('draft');
      const issuedInvoices = await this.repository.getInvoicesByStatus('issued');
      const sentInvoices = await this.repository.getInvoicesByStatus('sent');

      const allInvoices = [...draftInvoices, ...issuedInvoices, ...sentInvoices].filter(
        (invoice) => invoice.smartBillId != null,
      );

      if (allInvoices.length === 0) {
        logger.info('No invoices to sync status for');
        return result;
      }

      logger.info(`Starting invoice status sync for ${allInvoices.length} invoices`);

      // 2. Process in batches with rate limiting
      for (let i = 0; i < allInvoices.length; i += BATCH_SIZE) {
        const batch = allInvoices.slice(i, i + BATCH_SIZE);

        for (const invoice of batch) {
          try {
            await this.processInvoice(invoice, result);
          } catch (error) {
            result.errors++;
            logger.warn('Error syncing invoice status', {
              invoiceId: invoice.id,
              smartBillId: invoice.smartBillId,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          result.checked++;

          // Rate limiting: delay between API calls
          await this.sleep(DELAY_BETWEEN_CALLS_MS);
        }
      }

      logger.info('Invoice status sync completed', {
        checked: result.checked,
        updated: result.updated,
        errors: result.errors,
      });

      return result;
    } catch (error) {
      logger.error('Invoice status sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async processInvoice(
    invoice: SmartBillInvoice,
    result: InvoiceStatusSyncResult,
  ): Promise<void> {
    // Call SmartBill API for current payment status
    const paymentStatus = await this.apiClient.getPaymentStatus(invoice.smartBillId!);
    const oldStatus = invoice.status;

    // 3. Check if status changed
    if (paymentStatus.status === oldStatus) {
      return;
    }

    // Status has changed - update the invoice
    if (paymentStatus.status === 'paid') {
      invoice.markPaid(paymentStatus.paidAmount, paymentStatus.paymentDate || new Date());
    } else if (paymentStatus.status === 'cancelled' || paymentStatus.status === 'canceled') {
      invoice.markCancelled();
    } else if (paymentStatus.status === 'sent') {
      invoice.markSent();
    }

    // Save updated invoice to DB
    await this.repository.updateInvoice(invoice);

    // Update order payment status if applicable
    if (invoice.orderId && paymentStatus.status === 'paid') {
      try {
        await this.orderService.updateOrderWithSmartBillId({
          orderId: invoice.orderId,
          smartBillInvoiceId: invoice.smartBillId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceSeries: invoice.series,
          status: 'PAID',
        });
      } catch (updateError) {
        logger.warn('Failed to update order payment status', {
          orderId: invoice.orderId,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }
    }

    // Publish status changed event
    await this.eventBus.publish('smartbill.invoice_status_changed', {
      invoiceId: invoice.id,
      orderId: invoice.orderId,
      smartBillId: invoice.smartBillId,
      invoiceNumber: invoice.invoiceNumber,
      oldStatus,
      newStatus: invoice.status,
      paidAmount: paymentStatus.paidAmount,
      totalAmount: paymentStatus.totalAmount,
      paymentDate: paymentStatus.paymentDate,
      syncedAt: new Date().toISOString(),
    });

    result.updated++;
    result.details.push({
      invoiceId: invoice.id!,
      oldStatus,
      newStatus: invoice.status,
    });

    logger.info('Invoice status updated', {
      invoiceId: invoice.id,
      oldStatus,
      newStatus: invoice.status,
      paidAmount: paymentStatus.paidAmount,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
