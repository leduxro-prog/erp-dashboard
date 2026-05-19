import { DataSource } from 'typeorm';

import { InvoiceItem, SmartBillProforma } from '../../domain/entities';
import { ISmartBillRepository } from '../../domain/repositories/ISmartBillRepository';
import { ProformaCreationError } from '../errors/smartbill.errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('CreateB2BProforma');

export interface CreateB2BProformaDto {
  b2bOrderId: number;
  series?: string;
  dueInDays?: number;
}

export interface B2BProformaResultDto {
  id: number;
  b2bOrderId: number;
  orderId: string;
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

export interface ISmartBillApiClientForB2BProforma {
  createProforma(payload: any): Promise<{ id: string; number: string; status: string }>;
}

export interface IEventBusForB2BProforma {
  publish(eventName: string, data: any): Promise<void>;
}

interface B2BOrderRow {
  id: number;
  order_number?: string | null;
  customer_id?: number | string | null;
  subtotal?: number | string | null;
  vat_amount?: number | string | null;
  total?: number | string | null;
  currency_code?: string | null;
  payment_due_date?: Date | string | null;
  created_at?: Date | string | null;
  company_name?: string | null;
  cui?: string | null;
}

interface B2BOrderItemRow {
  sku?: string | null;
  product_name?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
}

export class CreateB2BProformaUseCase {
  constructor(
    private readonly repository: ISmartBillRepository,
    private readonly apiClient: ISmartBillApiClientForB2BProforma,
    private readonly eventBus: IEventBusForB2BProforma,
    private readonly dataSource: DataSource,
  ) {}

  async execute(dto: CreateB2BProformaDto): Promise<B2BProformaResultDto> {
    const { b2bOrderId, series = 'PF', dueInDays = 30 } = dto;
    const orderId = `B2B-${b2bOrderId}`;

    try {
      if (!Number.isInteger(b2bOrderId) || b2bOrderId <= 0) {
        throw new ProformaCreationError('B2B order id is required', String(b2bOrderId));
      }

      const existing = await this.repository.getProformaByOrderId(orderId);
      if (existing?.isTerminallyBlockedForExternalCreate()) {
        throw new ProformaCreationError(
          `SmartBill proforma creation for B2B order #${b2bOrderId} is ${existing.status} and requires operator reconciliation`,
          orderId,
        );
      }

      if (existing && existing.status !== 'cancelled' && existing.status !== 'failed') {
        throw new ProformaCreationError(
          `A SmartBill proforma already exists for B2B order #${b2bOrderId}`,
          orderId,
        );
      }

      const order = await this.getOrder(b2bOrderId);
      const customerName = this.requireText(order.company_name, 'B2B customer company name', orderId);
      const customerVat = this.requireText(order.cui, 'B2B customer CUI', orderId);

      const itemRows = await this.getOrderItems(b2bOrderId);
      const vatRate = this.calculateVatRate(order);
      const items = this.mapItems(itemRows, vatRate, orderId);
      const totalWithoutVat = this.roundMoney(
        items.reduce((sum, item) => sum + item.totalWithoutVat, 0),
      );
      const vatAmount = this.roundMoney(items.reduce((sum, item) => sum + item.vatAmount, 0));
      const totalWithVat = this.roundMoney(totalWithoutVat + vatAmount);

      if (totalWithoutVat <= 0 || totalWithVat <= 0) {
        throw new ProformaCreationError('B2B order total must be positive', orderId);
      }

      const issueDate = new Date();
      const dueDate = this.resolveDueDate(order.payment_due_date, issueDate, dueInDays);
      const currency = order.currency_code || 'RON';
      const proforma = new SmartBillProforma(
        undefined,
        orderId,
        undefined,
        undefined,
        series,
        customerName,
        customerVat,
        items,
        totalWithoutVat,
        vatAmount,
        totalWithVat,
        currency,
        'draft',
        issueDate,
        dueDate,
      );
      proforma.markPendingExternal();
      const savedDraftProforma = await this.savePendingProformaOrFailClosed(proforma, b2bOrderId);

      logger.info('Creating SmartBill proforma from B2B order', {
        b2bOrderId,
        orderNumber: order.order_number,
        customerName,
        totalItems: items.length,
      });

      let apiResponse: { id: string; number: string; status: string };
      try {
        apiResponse = await this.apiClient.createProforma({
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
        });
      } catch (error) {
        savedDraftProforma.markRequiresReconciliation();
        try {
          await this.repository.updateProforma(savedDraftProforma);
        } catch (updateError) {
          logger.error('Failed to mark pending B2B proforma for SmartBill reconciliation', {
            b2bOrderId,
            orderId,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });

          throw new ProformaCreationError(
            `SmartBill proforma attempt for B2B order #${b2bOrderId} is left pending_external and requires operator reconciliation`,
            orderId,
          );
        }
        throw error;
      }

      savedDraftProforma.markIssued(apiResponse.id, apiResponse.number, apiResponse.status as any);
      await this.repository.updateProforma(savedDraftProforma);
      await this.persistB2BOrderReference(b2bOrderId, apiResponse.number);

      await this.eventBus.publish('smartbill.b2b_proforma_created', {
        proformaId: savedDraftProforma.id,
        b2bOrderId,
        orderNumber: order.order_number,
        smartBillId: savedDraftProforma.smartBillId,
        proformaNumber: savedDraftProforma.proformaNumber,
        totalWithVat: savedDraftProforma.totalWithVat,
        customerName,
        customerVat,
        status: apiResponse.status || 'sent',
      });

      return this.mapToDto(savedDraftProforma, b2bOrderId);
    } catch (error) {
      await this.eventBus
        .publish('smartbill.b2b_proforma_creation_failed', {
          b2bOrderId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        .catch(() => {
          // Ignore event bus errors while preserving the original failure.
        });

      if (error instanceof ProformaCreationError) {
        throw error;
      }

      throw new ProformaCreationError(
        `Failed to create B2B proforma: ${error instanceof Error ? error.message : 'Unknown error'}`,
        orderId,
      );
    }
  }

  private async getOrder(b2bOrderId: number): Promise<B2BOrderRow> {
    const rows = await this.dataSource.query(
      `SELECT o.id, o.order_number, o.customer_id, o.subtotal, o.vat_amount, o.total,
              o.currency_code, o.payment_due_date, o.created_at, c.company_name, c.cui
       FROM b2b_orders o
       LEFT JOIN b2b_customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [b2bOrderId],
    );

    if (rows.length === 0) {
      throw new ProformaCreationError(`B2B order #${b2bOrderId} not found`, `B2B-${b2bOrderId}`);
    }

    return rows[0];
  }

  private isUniqueViolation(error: any): boolean {
    const code = String(error?.code || error?.driverError?.code || '');
    if (code === '23505') {
      return true;
    }

    const message = String(error?.message || '').toLowerCase();
    return message.includes('duplicate key') || message.includes('unique constraint');
  }

  private async savePendingProformaOrFailClosed(
    proforma: SmartBillProforma,
    b2bOrderId: number,
  ): Promise<SmartBillProforma> {
    try {
      return await this.repository.saveProforma(proforma);
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.repository.getProformaByOrderId(proforma.orderId);
      logger.warn('B2B proforma idempotency boundary rejected duplicate pending insert', {
        b2bOrderId,
        orderId: proforma.orderId,
        existingStatus: existing?.status,
      });

      throw new ProformaCreationError(
        `SmartBill proforma creation for B2B order #${b2bOrderId} is already in progress or requires reconciliation`,
        proforma.orderId,
      );
    }
  }

  private async getOrderItems(b2bOrderId: number): Promise<B2BOrderItemRow[]> {
    return this.dataSource.query(
      `SELECT sku, product_name, quantity, unit_price, total_price
       FROM b2b_order_items
       WHERE order_id = $1
       ORDER BY id`,
      [b2bOrderId],
    );
  }

  private mapItems(rows: B2BOrderItemRow[], vatRate: number, orderId: string): InvoiceItem[] {
    if (rows.length === 0) {
      throw new ProformaCreationError('B2B order has no line items', orderId);
    }

    return rows.map((row) => {
      const productName = this.requireText(row.product_name, 'B2B order item product name', orderId);
      const quantity = this.toPositiveNumber(row.quantity, 'B2B order item quantity', orderId);
      const totalPrice = this.toPositiveNumber(row.total_price, 'B2B order item total price', orderId);
      const unitPrice = this.roundMoney(totalPrice / quantity);
      const totalWithoutVat = this.roundMoney(unitPrice * quantity);

      return {
        productName,
        sku: row.sku || '',
        quantity,
        unitPrice,
        vatRate,
        totalWithoutVat,
        vatAmount: SmartBillProforma.calculateVat(totalWithoutVat, vatRate),
      };
    });
  }

  private calculateVatRate(order: B2BOrderRow): number {
    const subtotal = Number(order.subtotal || 0);
    const vatAmount = Number(order.vat_amount || 0);
    if (subtotal > 0 && vatAmount >= 0) {
      return this.roundMoney(vatAmount / subtotal);
    }
    return 0.21;
  }

  private resolveDueDate(value: Date | string | null | undefined, issueDate: Date, dueInDays: number): Date {
    if (value) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + dueInDays);
    return dueDate;
  }

  private requireText(value: string | null | undefined, field: string, orderId: string): string {
    const text = value?.trim();
    if (!text) {
      throw new ProformaCreationError(`${field} is required`, orderId);
    }
    return text;
  }

  private toPositiveNumber(
    value: number | string | null | undefined,
    field: string,
    orderId: string,
  ): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new ProformaCreationError(`${field} must be positive`, orderId);
    }
    return numberValue;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async persistB2BOrderReference(b2bOrderId: number, proformaNumber: string): Promise<void> {
    try {
      await this.dataSource.query(
        `UPDATE b2b_orders
         SET proforma_number = $1, updated_at = NOW()
         WHERE id = $2`,
        [proformaNumber, b2bOrderId],
      );
    } catch (error) {
      logger.warn('Could not persist SmartBill proforma number on B2B order', {
        b2bOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapToDto(proforma: SmartBillProforma, b2bOrderId: number): B2BProformaResultDto {
    return {
      id: proforma.id!,
      b2bOrderId,
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
