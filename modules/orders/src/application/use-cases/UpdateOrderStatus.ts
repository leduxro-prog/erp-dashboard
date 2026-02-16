/**
 * Update Order Status Use Case
 * Validates and transitions order status with side effects and event publishing
 */
import { Order, OrderStatus, IOrderRepository } from '../../domain';
import { UpdateOrderStatusInput } from '../dtos';
import {
  OrderNotFoundError,
  InvalidStatusTransitionError,
  OrderCancellationError,
} from '../errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('update-order-status');

/**
 * Invoice service interface for generating invoices
 */
export interface IInvoiceService {
  createInvoice(orderId: number, invoiceDate: Date): Promise<string>;
  createProforma(orderId: number): Promise<string>;
}

/**
 * Stock service interface for releasing reservations
 */
export interface IStockService {
  releaseReservation(orderId: number): Promise<void>;
}

/**
 * Event publisher interface for domain events
 */
export interface IEventPublisher {
  publish(event: any): Promise<void>;
}

export class UpdateOrderStatus {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly invoiceService: IInvoiceService,
    private readonly stockService: IStockService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(input: UpdateOrderStatusInput): Promise<void> {
    // Fetch order
    const order = await this.orderRepository.getById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(`Order ID: ${input.orderId}`);
    }

    // Validate status transition
    try {
      order.updateStatus(input.newStatus, input.changedBy, input.notes);
    } catch (error) {
      const validStatuses = order.canTransitionTo(input.newStatus)
        ? []
        : []; // Already validated in updateStatus

      throw new InvalidStatusTransitionError(
        order.status,
        input.newStatus,
        validStatuses
      );
    }

    // Handle status-specific side effects
    await this.handleStatusSpecificSideEffects(order, input.newStatus);

    // Save updated order
    await this.orderRepository.update(order);

    // Publish status changed event
    await this.eventPublisher.publish({
      type: 'order.status_changed',
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus: input.newStatus === OrderStatus.SHIPPED ? 'shipped' : order.status,
      newStatus: input.newStatus,
      changedBy: input.changedBy,
      notes: input.notes,
      timestamp: new Date(),
    });
  }

  private async handleStatusSpecificSideEffects(
    order: Order,
    newStatus: OrderStatus
  ): Promise<void> {
    switch (newStatus) {
      case OrderStatus.SHIPPED:
        // Auto-create invoice on shipment
        await this.handleShipment(order);
        break;

      case OrderStatus.CANCELLED:
        // Release stock reservations
        await this.handleCancellation(order);
        break;

      case OrderStatus.DELIVERED:
        // Publish delivered event
        await this.eventPublisher.publish({
          type: 'order.delivered',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          timestamp: new Date(),
        });
        break;

      case OrderStatus.QUOTE_SENT:
        // Publish quote sent event
        await this.eventPublisher.publish({
          type: 'order.quote_sent',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          timestamp: new Date(),
        });
        break;

      case OrderStatus.QUOTE_ACCEPTED:
        // Publish quote accepted event
        await this.eventPublisher.publish({
          type: 'order.quote_accepted',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          timestamp: new Date(),
        });
        break;

      case OrderStatus.ORDER_CONFIRMED:
        // Publish order confirmed event
        await this.eventPublisher.publish({
          type: 'order.confirmed',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          timestamp: new Date(),
        });
        break;

      // Other statuses don't require special handling
      default:
        break;
    }
  }

  private async handleShipment(order: Order): Promise<void> {
    try {
      // Generate invoice via SmartBill integration
      const invoiceNumber = await this.invoiceService.createInvoice(
        order.id,
        new Date()
      );

      order.invoiceNumber = invoiceNumber;
      order.paymentStatus = 'pending';

      // Publish shipment event
      await this.eventPublisher.publish({
        type: 'order.shipped',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        invoiceNumber: invoiceNumber,
        total: order.grandTotal,
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't prevent status update
      // Invoice generation can be retried later
      logger.error(
        `Failed to generate invoice for order ${order.id}:`,
        { error }
      );

      await this.eventPublisher.publish({
        type: 'order.shipment_error',
        orderId: order.id,
        orderNumber: order.orderNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
    }
  }

  private async handleCancellation(order: Order): Promise<void> {
    try {
      // Release stock reservations
      await this.stockService.releaseReservation(order.id);

      // Publish cancellation event
      await this.eventPublisher.publish({
        type: 'order.cancelled',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        reason: 'Order was cancelled',
        timestamp: new Date(),
      });
    } catch (error) {
      throw new OrderCancellationError(
        order.id,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
