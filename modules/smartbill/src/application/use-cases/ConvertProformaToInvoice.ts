import { SmartBillInvoice, InvoiceItem } from '../../domain/entities/SmartBillInvoice';
import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { InvoiceResultDto } from '../dtos/smartbill.dtos';
import { SmartBillError } from '../errors/smartbill.errors';
import { createModuleLogger } from '@shared/utils/logger';
import { DataSource } from 'typeorm';

const logger = createModuleLogger('smartbill');

export interface ISmartBillApiClientConvert {
  convertProformaToInvoice(
    seriesName: string,
    number: string,
  ): Promise<{ id: string; number: string; invoiceSeries: string; invoiceNumber: string }>;
}

export interface IEventBusConvert {
  publish(eventName: string, data: any): Promise<void>;
}

export interface IOrderServiceConvert {
  getOrderById(orderId: string): Promise<any>;
  updateOrderWithSmartBillId(params: {
    orderId: string;
    smartBillInvoiceId?: string;
    invoiceNumber?: string;
    invoiceSeries?: string;
    status?: string;
  }): Promise<{ success: boolean; orderNumber: string; message?: string }>;
}

export class ProformaConversionError extends SmartBillError {
  constructor(
    message: string,
    public readonly proformaId?: number,
  ) {
    super(message, 'PROFORMA_CONVERSION_ERROR');
    this.name = 'ProformaConversionError';
  }
}

export class ConvertProformaToInvoiceUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientConvert,
    private readonly eventBus: IEventBusConvert,
    private readonly orderService: IOrderServiceConvert,
    private readonly dataSource: DataSource,
  ) {}

  async execute(proformaId: number): Promise<InvoiceResultDto> {
    try {
      // 1. Look up the proforma by ID
      const proforma = await this.repository.getProforma(proformaId);
      if (!proforma) {
        throw new ProformaConversionError('Proforma not found', proformaId);
      }

      // 2. Validate proforma status
      if (proforma.status === 'converted') {
        throw new ProformaConversionError(
          'Proforma has already been converted to an invoice',
          proformaId,
        );
      }
      if (proforma.status === 'cancelled') {
        throw new ProformaConversionError('Cannot convert a cancelled proforma', proformaId);
      }

      if (!proforma.smartBillId || !proforma.proformaNumber) {
        throw new ProformaConversionError(
          'Proforma has not been issued to SmartBill yet',
          proformaId,
        );
      }

      // 3. Call SmartBill API to convert proforma to invoice
      const apiResponse = await this.apiClient.convertProformaToInvoice(
        proforma.series,
        proforma.proformaNumber,
      );

      logger.info('Proforma converted to invoice via SmartBill API', {
        proformaId,
        smartBillInvoiceId: apiResponse.id,
        invoiceNumber: apiResponse.invoiceNumber,
      });

      // 4. Create a new SmartBillInvoice domain entity from conversion response
      const invoiceItems: InvoiceItem[] = proforma.items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalWithoutVat: item.totalWithoutVat,
        vatAmount: item.vatAmount,
      }));

      const invoice = new SmartBillInvoice(
        undefined,
        proforma.orderId,
        apiResponse.id,
        apiResponse.invoiceNumber || apiResponse.number,
        apiResponse.invoiceSeries || 'FL',
        proforma.customerName,
        proforma.customerVat,
        invoiceItems,
        proforma.totalWithoutVat,
        proforma.vatAmount,
        proforma.totalWithVat,
        proforma.currency,
        'issued',
        new Date(),
        proforma.dueDate,
        new Date(),
        0,
        null,
        'sent',
      );

      // 5. Mark proforma as converted and save
      proforma.markConverted();
      await this.repository.updateProforma(proforma);

      // 6. Save the new invoice
      const savedInvoice = await this.repository.saveInvoice(invoice);

      // 7. Update order with SmartBill invoice ID (if orderId exists)
      if (proforma.orderId && this.orderService.updateOrderWithSmartBillId) {
        try {
          await this.orderService.updateOrderWithSmartBillId({
            orderId: proforma.orderId,
            smartBillInvoiceId: apiResponse.id,
            invoiceNumber: apiResponse.invoiceNumber || apiResponse.number,
            invoiceSeries: apiResponse.invoiceSeries || 'FL',
            status: 'ISSUED',
          });
        } catch (updateError) {
          // Log but don't fail - conversion was successful
          logger.warn('Failed to update order with SmartBill invoice ID:', { error: updateError });
        }
      }

      // 8. Publish events
      await this.eventBus.publish('smartbill.proforma_converted', {
        proformaId: proforma.id,
        orderId: proforma.orderId,
        proformaSmartBillId: proforma.smartBillId,
        proformaNumber: proforma.proformaNumber,
        invoiceId: savedInvoice.id,
        invoiceSmartBillId: savedInvoice.smartBillId,
        invoiceNumber: savedInvoice.invoiceNumber,
        invoiceSeries: savedInvoice.series,
        totalWithVat: savedInvoice.totalWithVat,
        convertedAt: new Date().toISOString(),
      });

      await this.eventBus.publish('invoice.created', {
        invoiceId: savedInvoice.id,
        orderId: savedInvoice.orderId,
        smartBillId: savedInvoice.smartBillId,
        invoiceNumber: savedInvoice.invoiceNumber,
        totalWithVat: savedInvoice.totalWithVat,
        source: 'proforma_conversion',
      });

      // 9. Return invoice details
      return this.mapToDto(savedInvoice);
    } catch (error) {
      // Emit failure event
      await this.eventBus
        .publish('smartbill.proforma_conversion_failed', {
          proformaId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          // Ignore event bus errors
        });

      if (error instanceof ProformaConversionError) {
        throw error;
      }
      throw new ProformaConversionError(
        `Failed to convert proforma to invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        proformaId,
      );
    }
  }

  private mapToDto(invoice: SmartBillInvoice): InvoiceResultDto {
    return {
      id: invoice.id!,
      orderId: invoice.orderId,
      smartBillId: invoice.smartBillId!,
      invoiceNumber: invoice.invoiceNumber!,
      series: invoice.series,
      customerName: invoice.customerName,
      customerVat: invoice.customerVat,
      totalWithoutVat: invoice.totalWithoutVat,
      vatAmount: invoice.vatAmount,
      totalWithVat: invoice.totalWithVat,
      currency: invoice.currency,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      createdAt: invoice.createdAt,
      items: invoice.items,
    };
  }
}
