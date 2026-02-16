import { SmartBillProforma, InvoiceItem } from '../../domain/entities';
import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { CreateProformaDto, ProformaResultDto } from '../dtos/smartbill.dtos';
import { ProformaCreationError } from '../errors/smartbill.errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('smartbill');

export interface ISmartBillApiClientProforma {
  createProforma(payload: any): Promise<{ id: string; number: string; status: string }>;
}

export interface IEventBusProforma {
  publish(eventName: string, data: any): Promise<void>;
}

export interface IOrderServiceProforma {
  getOrderById(orderId: string): Promise<any>;
  updateOrderWithSmartBillId(params: {
    orderId: string;
    smartBillProformaId?: string;
    proformaNumber?: string;
    proformaSeries?: string;
  }): Promise<{ success: boolean; orderNumber: string; message?: string }>;
}

export class CreateProformaUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientProforma,
    private readonly eventBus: IEventBusProforma,
    private readonly orderService: IOrderServiceProforma,
  ) {}

  async execute(dto: CreateProformaDto): Promise<ProformaResultDto> {
    try {
      const order = await this.orderService.getOrderById(dto.orderId);
      if (!order) {
        throw new ProformaCreationError('Order not found', dto.orderId);
      }

      const items: InvoiceItem[] = dto.items.map((item) => ({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalWithoutVat: item.quantity * item.unitPrice,
        vatAmount: SmartBillProforma.calculateVat(item.quantity * item.unitPrice, item.vatRate),
      }));

      const proforma = SmartBillProforma.createFromOrder(
        dto.orderId,
        dto.customerName,
        dto.customerVat,
        items,
        dto.dueDate,
      );

      const apiPayload = this.buildApiPayload(proforma, dto);
      const apiResponse = await this.apiClient.createProforma(apiPayload);

      // Mark proforma as issued with SmartBill details
      // Include the SmartBill API status
      proforma.markIssued(apiResponse.id, apiResponse.number, apiResponse.status as any);

      const savedProforma = await this.repository.saveProforma(proforma);

      // Update order with SmartBill proforma information
      if (this.orderService.updateOrderWithSmartBillId) {
        try {
          await this.orderService.updateOrderWithSmartBillId({
            orderId: dto.orderId,
            smartBillProformaId: apiResponse.id,
            proformaNumber: apiResponse.number,
            proformaSeries: dto.series || 'PF',
          });
        } catch (updateError) {
          // Log but don't fail - proforma was created successfully
          logger.warn('Failed to update order with SmartBill proforma ID:', { error: updateError });
        }
      }

      // Emit real proforma created event to event bus
      await this.eventBus.publish('smartbill.proforma_created', {
        proformaId: savedProforma.id,
        orderId: savedProforma.orderId,
        smartBillId: savedProforma.smartBillId,
        proformaNumber: savedProforma.proformaNumber,
        proformaSeries: savedProforma.series,
        totalWithVat: savedProforma.totalWithVat,
        totalWithoutVat: savedProforma.totalWithoutVat,
        vatAmount: savedProforma.vatAmount,
        currency: savedProforma.currency,
        customerName: savedProforma.customerName,
        customerVat: savedProforma.customerVat,
        status: apiResponse.status || 'sent',
        issueDate: savedProforma.issueDate,
        dueDate: savedProforma.dueDate,
        items: savedProforma.items,
      });

      // Also emit legacy event for backward compatibility
      await this.eventBus.publish('proforma.created', {
        proformaId: savedProforma.id,
        orderId: savedProforma.orderId,
        smartBillId: savedProforma.smartBillId,
        proformaNumber: savedProforma.proformaNumber,
        totalWithVat: savedProforma.totalWithVat,
      });

      return this.mapToDto(savedProforma);
    } catch (error) {
      // Emit failure event
      await this.eventBus
        .publish('smartbill.proforma_creation_failed', {
          orderId: dto.orderId,
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
        `Failed to create proforma: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dto.orderId,
      );
    }
  }

  private buildApiPayload(proforma: SmartBillProforma, dto: CreateProformaDto): any {
    return {
      companyName: proforma.customerName,
      companyVat: proforma.customerVat,
      proformaSeries: dto.series || 'PF',
      issueDate: proforma.issueDate.toISOString().split('T')[0],
      dueDate: proforma.dueDate.toISOString().split('T')[0],
      currency: dto.currency || 'RON',
      items: proforma.items.map((item) => ({
        name: item.productName,
        measuringUnit: 'buc',
        quantity: item.quantity,
        price: item.unitPrice,
        vat: item.vatRate * 100,
        vatAmount: item.vatAmount,
      })),
    };
  }

  private mapToDto(proforma: SmartBillProforma): ProformaResultDto {
    return {
      id: proforma.id!,
      orderId: proforma.orderId,
      smartBillId: proforma.smartBillId!,
      proformaNumber: proforma.proformaNumber!,
      series: proforma.series,
      customerName: proforma.customerName,
      customerVat: proforma.customerVat,
      totalWithoutVat: proforma.totalWithoutVat,
      vatAmount: proforma.vatAmount,
      totalWithVat: proforma.totalWithVat,
      currency: proforma.currency,
      status: proforma.status,
      issueDate: proforma.issueDate,
      dueDate: proforma.dueDate,
      createdAt: proforma.createdAt,
      items: proforma.items,
    };
  }
}
