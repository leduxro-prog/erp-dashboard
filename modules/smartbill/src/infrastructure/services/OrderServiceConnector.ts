/**
 * OrderServiceConnector - Real integration with Orders module
 *
 * Provides bridge between SmartBill module and Orders module,
 * allowing SmartBill to update orders with invoice/proforma information.
 */

import { createModuleLogger } from '@shared/utils/logger';
import {
  mapSmartBillToPaymentStatus,
  mapSmartBillInvoiceToErp,
  isSmartBillInvoiceFinal,
} from '@shared/constants/status-mapping';
import { DataSource, Repository } from 'typeorm';

const logger = createModuleLogger('smartbill-order-connector');

/**
 * Order entity interface (from Orders module)
 */
interface OrderEntity {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_id: string;
  status: string;
  payment_status: string;
  proforma_number: string | null;
  invoice_number: string | null;
  smartbill_invoice_id: string | null;
  smartbill_proforma_id: string | null;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  grand_total: number;
  currency: string;
  payment_terms: string;
  billing_address: Record<string, any> | null;
  shipping_address: Record<string, any> | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  items?: OrderItemEntity[];
}

/**
 * Order item interface
 */
interface OrderItemEntity {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * SmartBill order update payload
 */
export interface UpdateOrderWithSmartBillIdParams {
  orderId: string;
  smartBillInvoiceId?: string;
  smartBillProformaId?: string;
  invoiceNumber?: string;
  proformaNumber?: string;
  invoiceSeries?: string;
  proformaSeries?: string;
  status?: string;
}

/**
 * Result of order update
 */
export interface OrderUpdateResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  message?: string;
}

/**
 * OrderServiceConnector provides real integration with Orders module
 */
export class OrderServiceConnector {
  private orderRepository: Repository<OrderEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.orderRepository = this.dataSource.getRepository('orders') as Repository<OrderEntity>;
  }

  /**
   * Get order by ID
   *
   * @param orderId - Order UUID
   * @returns Order entity or null if not found
   */
  async getOrderById(orderId: string): Promise<OrderEntity | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items'],
      });

      return order;
    } catch (error) {
      logger.error('Failed to fetch order by ID', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get order by order number
   *
   * @param orderNumber - Order number (e.g., ORD-20240115-0001)
   * @returns Order entity or null if not found
   */
  async getOrderByNumber(orderNumber: string): Promise<OrderEntity | null> {
    try {
      const order = await this.orderRepository.findOne({
        where: { order_number: orderNumber },
        relations: ['items'],
      });

      return order;
    } catch (error) {
      logger.error('Failed to fetch order by number', {
        orderNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update order with SmartBill invoice/proforma information
   *
   * Persists the smartbill_id in ERP order tables using the
   * dedicated smartbill_invoice_id and smartbill_proforma_id fields.
   *
   * @param params - Update parameters
   * @returns Update result
   */
  async updateOrderWithSmartBillId(
    params: UpdateOrderWithSmartBillIdParams,
  ): Promise<OrderUpdateResult> {
    try {
      const order = await this.getOrderById(params.orderId);

      if (!order) {
        logger.warn('Order not found for SmartBill update', { orderId: params.orderId });
        return {
          success: false,
          orderId: params.orderId,
          orderNumber: '',
          message: 'Order not found',
        };
      }

      const updateData: Partial<OrderEntity> = {};

      // Persist SmartBill invoice ID in dedicated column
      if (params.smartBillInvoiceId) {
        updateData.smartbill_invoice_id = params.smartBillInvoiceId;
      }

      // Persist SmartBill proforma ID in dedicated column
      if (params.smartBillProformaId) {
        updateData.smartbill_proforma_id = params.smartBillProformaId;
      }

      // Update invoice/proforma number fields
      if (params.invoiceNumber) {
        updateData.invoice_number = params.invoiceNumber;
      }
      if (params.proformaNumber) {
        updateData.proforma_number = params.proformaNumber;
      }

      // Update order status if provided
      if (params.status) {
        updateData.status = params.status;
      }

      // Perform update
      await this.orderRepository.update(params.orderId, updateData);

      logger.info('Order updated with SmartBill information', {
        orderId: params.orderId,
        orderNumber: order.order_number,
        smartbillInvoiceId: params.smartBillInvoiceId,
        smartbillProformaId: params.smartBillProformaId,
        invoiceNumber: params.invoiceNumber,
        proformaNumber: params.proformaNumber,
      });

      return {
        success: true,
        orderId: params.orderId,
        orderNumber: order.order_number,
      };
    } catch (error) {
      logger.error('Failed to update order with SmartBill ID', {
        orderId: params.orderId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        orderId: params.orderId,
        orderNumber: '',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update order payment status
   *
   * @param orderId - Order UUID
   * @param paymentStatus - New payment status
   * @returns Update result
   */
  async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED',
  ): Promise<OrderUpdateResult> {
    try {
      const result = await this.orderRepository.update(orderId, { payment_status: paymentStatus });

      if (result.affected === 0) {
        return {
          success: false,
          orderId,
          orderNumber: '',
          message: 'Order not found or not updated',
        };
      }

      const order = await this.getOrderById(orderId);

      logger.info('Order payment status updated', {
        orderId,
        orderNumber: order?.order_number,
        paymentStatus,
      });

      return {
        success: true,
        orderId,
        orderNumber: order?.order_number || '',
      };
    } catch (error) {
      logger.error('Failed to update order payment status', {
        orderId,
        paymentStatus,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        orderId,
        orderNumber: '',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get SmartBill IDs from order using dedicated columns
   *
   * @param orderId - Order UUID
   * @returns SmartBill IDs if found
   */
  async getSmartBillIdsFromOrder(orderId: string): Promise<{
    invoiceId?: string;
    proformaId?: string;
    invoiceNumber?: string;
    proformaNumber?: string;
  } | null> {
    try {
      const order = await this.getOrderById(orderId);

      if (!order) {
        return null;
      }

      const result: Record<string, string | undefined> = {};
      if (order.smartbill_invoice_id) result.invoiceId = order.smartbill_invoice_id;
      if (order.smartbill_proforma_id) result.proformaId = order.smartbill_proforma_id;
      if (order.invoice_number) result.invoiceNumber = order.invoice_number;
      if (order.proforma_number) result.proformaNumber = order.proforma_number;

      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      logger.error('Failed to get SmartBill IDs from order', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update order payment status from a SmartBill invoice status.
   *
   * Translates the external SmartBill status into the ERP payment status
   * using the unified status-mapping, then persists the result.
   *
   * @param orderId - Order UUID
   * @param smartBillStatus - SmartBill invoice status string (e.g. 'paid', 'canceled', 'storno')
   * @returns Update result with mapped status info
   */
  async updatePaymentStatusFromSmartBill(
    orderId: string,
    smartBillStatus: string,
  ): Promise<OrderUpdateResult & { mappedPaymentStatus?: string; invoiceStatus?: string }> {
    const paymentStatus = mapSmartBillToPaymentStatus(smartBillStatus);
    const invoiceStatus = mapSmartBillInvoiceToErp(smartBillStatus);
    const isFinal = isSmartBillInvoiceFinal(smartBillStatus);

    logger.info('Mapping SmartBill status to ERP payment status', {
      orderId,
      smartBillStatus,
      paymentStatus,
      invoiceStatus,
      isFinal,
    });

    const result = await this.updateOrderPaymentStatus(orderId, paymentStatus);

    return {
      ...result,
      mappedPaymentStatus: paymentStatus,
      invoiceStatus,
    };
  }
}
