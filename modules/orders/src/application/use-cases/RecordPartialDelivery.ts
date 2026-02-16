/**
 * Record Partial Delivery Use Case
 * Records partial or full delivery of order items and auto-transitions status if fully delivered
 */
import { Order, OrderStatus, IOrderRepository, OrderCalculationService } from '../../domain';
import {
  RecordPartialDeliveryInput,
  PartialDeliveryResult,
  OrderItemResult,
  DeliverySummary,
} from '../dtos';
import {
  OrderNotFoundError,
  InvalidDeliveryQuantityError,
  InvalidOrderInputError,
} from '../errors';

/**
 * Event publisher interface for domain events
 */
export interface IEventPublisher {
  publish(event: any): Promise<void>;
}

export class RecordPartialDelivery {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: RecordPartialDeliveryInput): Promise<PartialDeliveryResult> {
    // Fetch order
    const order = await this.orderRepository.getById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(`Order ID: ${input.orderId}`);
    }

    // Validate delivery items
    this.validateDeliveryItems(order, input.items);

    // Record delivery for each item
    try {
      order.recordPartialDelivery(
        input.items.map((item) => ({
          itemId: item.itemId,
          quantityDelivered: item.quantityDelivered,
        })),
      );
    } catch (error) {
      throw new InvalidDeliveryQuantityError('', 0, 0);
    }

    // Check if order is fully delivered and auto-transition status
    if (order.isFullyDelivered()) {
      order.updateStatus(
        OrderStatus.DELIVERED,
        input.userId,
        'Auto-transitioned from full delivery',
      );

      // Publish full delivery event
      await this.eventPublisher.publish({
        type: 'order.fully_delivered',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        timestamp: new Date(),
      });
    } else {
      // Publish partial delivery event
      await this.eventPublisher.publish({
        type: 'order.partially_delivered',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        deliveredItems: input.items,
        timestamp: new Date(),
      });
    }

    // Save updated order
    await this.orderRepository.update(order);

    // Calculate delivery summary
    const deliverySummary = OrderCalculationService.calculateDeliverySummary(order.items);

    return {
      orderId: order.id,
      items: order.items.map((item) => ({
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
        costPriceSnapshot: item.costPriceSnapshot,
        costSource: item.costSource,
        grossProfit: item.getGrossProfit(),
        grossMarginPercent: item.getGrossMarginPercent(),
      })),
      deliverySummary,
      isFullyDelivered: order.isFullyDelivered(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  private validateDeliveryItems(
    order: Order,
    deliveryItems: Array<{ itemId: string; quantityDelivered: number }>,
  ): void {
    if (!deliveryItems || deliveryItems.length === 0) {
      throw new InvalidOrderInputError('At least one delivery item is required');
    }

    for (const deliveryItem of deliveryItems) {
      const orderItem = order.items.find((i) => i.id === deliveryItem.itemId);

      if (!orderItem) {
        throw new InvalidOrderInputError(`Item ${deliveryItem.itemId} not found in order`);
      }

      if (deliveryItem.quantityDelivered <= 0) {
        throw new InvalidOrderInputError(
          `Delivery quantity must be greater than 0 for item ${deliveryItem.itemId}`,
        );
      }

      if (deliveryItem.quantityDelivered > orderItem.quantityRemaining) {
        throw new InvalidDeliveryQuantityError(
          deliveryItem.itemId,
          deliveryItem.quantityDelivered,
          orderItem.quantityRemaining,
        );
      }
    }
  }
}
