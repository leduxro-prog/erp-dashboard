/**
 * Get Order Use Case
 * Retrieves a single order by ID or order number
 */
import { IOrderRepository } from '../../domain';
import { GetOrderInput, OrderResult } from '../dtos';
import { OrderNotFoundError, InvalidOrderInputError } from '../errors';

export class GetOrder {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: GetOrderInput): Promise<OrderResult> {
    if (!input.orderId && !input.orderNumber) {
      throw new InvalidOrderInputError(
        'Either orderId or orderNumber must be provided'
      );
    }

    let order;

    if (input.orderId) {
      order = await this.orderRepository.getById(input.orderId);
    } else if (input.orderNumber) {
      order = await this.orderRepository.getByOrderNumber(input.orderNumber);
    }

    if (!order) {
      throw new OrderNotFoundError(
        input.orderId
          ? `Order ID: ${input.orderId}`
          : `Order Number: ${input.orderNumber}`
      );
    }

    return this.mapOrderToResult(order);
  }

  async getByOrderNumber(orderNumber: string): Promise<OrderResult> {
    const order = await this.orderRepository.getByOrderNumber(orderNumber);

    if (!order) {
      throw new OrderNotFoundError(`Order Number: ${orderNumber}`);
    }

    return this.mapOrderToResult(order);
  }

  private mapOrderToResult(order: any): OrderResult {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        quantityDelivered: item.quantityDelivered,
        quantityRemaining: item.quantityRemaining,
        lineTotal: item.getLineTotal(),
        sourceWarehouseId: item.sourceWarehouseId,
      })),
      billingAddress: order.billingAddress.toJSON(),
      shippingAddress: order.shippingAddress.toJSON(),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      shippingCost: order.shippingCost,
      grandTotal: order.grandTotal,
      currency: order.currency,
      taxRate: order.taxRate,
      paymentTerms: order.paymentTerms,
      paymentStatus: order.paymentStatus,
      proformaNumber: order.proformaNumber,
      invoiceNumber: order.invoiceNumber,
      notes: order.notes,
      statusHistory: order.statusHistory.map((s: any) => ({
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        changedBy: s.changedBy,
        changedAt: s.changedAt.toISOString(),
        notes: s.notes,
      })),
      createdBy: order.createdBy,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      updatedBy: order.updatedBy,
    };
  }
}
