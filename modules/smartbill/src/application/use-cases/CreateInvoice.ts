import { SmartBillInvoice, InvoiceItem } from '../../domain/entities/SmartBillInvoice';
import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { CreateInvoiceDto, InvoiceResultDto } from '../dtos/smartbill.dtos';
import { InvoiceCreationError } from '../errors/smartbill.errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill');

export interface ISmartBillApiClient {
  createInvoice(payload: any): Promise<{ id: string; number: string; status: string }>;
}

export interface IEventBus {
  publish(eventName: string, data: any): Promise<void>;
}

export interface IOrderService {
  getOrderById(orderId: string): Promise<any>;
  updateOrderWithSmartBillId(params: {
    orderId: string;
    smartBillInvoiceId?: string;
    invoiceNumber?: string;
    invoiceSeries?: string;
    status?: string;
  }): Promise<{ success: boolean; orderNumber: string; message?: string }>;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClient,
    private readonly eventBus: IEventBus,
    private readonly orderService: IOrderService,
  ) {}

  async execute(dto: CreateInvoiceDto): Promise<InvoiceResultDto> {
    try {
      const existingInvoice = await this.repository.getInvoiceByOrderId(dto.orderId);
      if (existingInvoice) {
        return this.mapToDto(existingInvoice);
      }

      // Validate order exists
      const order = await this.orderService.getOrderById(dto.orderId);
      if (!order) {
        throw new InvoiceCreationError('Order not found', dto.orderId);
      }

      // Create invoice items with VAT calculations
      const items: InvoiceItem[] = dto.items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalWithoutVat: item.quantity * item.unitPrice,
        vatAmount: SmartBillInvoice.calculateVat(item.quantity * item.unitPrice, item.vatRate),
      }));

      // Create invoice entity
      const invoice = SmartBillInvoice.createFromOrder(
        dto.orderId,
        dto.customerName,
        dto.customerVat,
        items,
        dto.dueDate,
      );

      // Build and call SmartBill API
      const apiPayload = this.buildApiPayload(invoice, dto);
      const apiResponse = await this.apiClient.createInvoice(apiPayload);

      // Mark invoice as issued with SmartBill details
      // Include the SmartBill API status
      invoice.markIssued(apiResponse.id, apiResponse.number, apiResponse.status as any);

      // Save to database
      let savedInvoice: SmartBillInvoice;
      try {
        savedInvoice = await this.repository.saveInvoice(invoice);
      } catch (saveError) {
        const duplicateInvoice = await this.repository.getInvoiceByOrderId(dto.orderId);
        if (duplicateInvoice) {
          return this.mapToDto(duplicateInvoice);
        }

        throw saveError;
      }

      // Update order with SmartBill information
      if (this.orderService.updateOrderWithSmartBillId) {
        try {
          await this.orderService.updateOrderWithSmartBillId({
            orderId: dto.orderId,
            smartBillInvoiceId: apiResponse.id,
            invoiceNumber: apiResponse.number,
            invoiceSeries: dto.series || 'FL',
            status: 'ISSUED',
          });
        } catch (updateError) {
          // Log but don't fail - invoice was created successfully
          logger.warn('Failed to update order with SmartBill ID:', { error: updateError });
        }
      }

      // Emit real invoice created event to event bus
      await this.eventBus.publish('smartbill.invoice_created', {
        invoiceId: savedInvoice.id,
        orderId: savedInvoice.orderId,
        smartBillId: savedInvoice.smartBillId,
        invoiceNumber: savedInvoice.invoiceNumber,
        invoiceSeries: savedInvoice.series,
        totalWithVat: savedInvoice.totalWithVat,
        totalWithoutVat: savedInvoice.totalWithoutVat,
        vatAmount: savedInvoice.vatAmount,
        currency: savedInvoice.currency,
        customerName: savedInvoice.customerName,
        customerVat: savedInvoice.customerVat,
        status: apiResponse.status || 'sent',
        issueDate: savedInvoice.issueDate,
        dueDate: savedInvoice.dueDate,
        items: savedInvoice.items,
      });

      // Also emit legacy event for backward compatibility
      await this.eventBus.publish('invoice.created', {
        invoiceId: savedInvoice.id,
        orderId: savedInvoice.orderId,
        smartBillId: savedInvoice.smartBillId,
        invoiceNumber: savedInvoice.invoiceNumber,
        totalWithVat: savedInvoice.totalWithVat,
      });

      return this.mapToDto(savedInvoice);
    } catch (error) {
      // Emit failure event
      await this.eventBus
        .publish('smartbill.invoice_creation_failed', {
          orderId: dto.orderId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          // Ignore event bus errors
        });

      if (error instanceof InvoiceCreationError) {
        throw error;
      }
      throw new InvoiceCreationError(
        `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dto.orderId,
      );
    }
  }

  private buildApiPayload(invoice: SmartBillInvoice, dto: CreateInvoiceDto): any {
    return {
      companyName: invoice.customerName,
      companyVat: invoice.customerVat,
      invoiceSeries: dto.series || 'FL',
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      currency: dto.currency || 'RON',
      items: invoice.items.map((item) => ({
        name: item.productName,
        measuringUnit: 'buc',
        quantity: item.quantity,
        price: item.unitPrice,
        vat: item.vatRate * 100,
        vatAmount: item.vatAmount,
      })),
    };
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
