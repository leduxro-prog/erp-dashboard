/**
 * Cancel Order Use Case
 * Cancels an order with validation, stock release, and event publishing
 */
import { IOrderRepository } from '../../domain';
import { CancelOrderInput } from '../dtos';
import { OrderNotFoundError, OrderCancellationError } from '../errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('cancel-order');

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

export class CancelOrder {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly stockService: IStockService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(input: CancelOrderInput): Promise<void> {
    // Fetch order
    const order = await this.orderRepository.getById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(`Order ID: ${input.orderId}`);
    }

    try {
      // Cancel order (will validate state machine transition)
      order.cancel(input.reason, input.cancelledBy);

      // Release stock reservations
      try {
        await this.stockService.releaseReservation(order.id);
      } catch (error) {
        // Log error but continue - stock may be released asynchronously
        logger.error(
          `Failed to release stock for order ${order.id}:`,
          { error }
        );
      }

      // Save cancelled order
      await this.orderRepository.update(order);

      // Publish order cancelled event
      await this.eventPublisher.publish({
        type: 'order.cancelled',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        reason: input.reason,
        cancelledBy: input.cancelledBy,
        timestamp: new Date(),
      });
    } catch (error) {
      throw new OrderCancellationError(
        input.orderId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}
