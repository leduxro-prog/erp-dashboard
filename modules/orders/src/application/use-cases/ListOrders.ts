/**
 * List Orders Use Case
 * Retrieves paginated list of orders with filtering and sorting
 */
import { IOrderRepository } from '../../domain';
import { ListOrdersInput, PaginatedResult, OrderSummaryResult } from '../dtos';
import { InvalidOrderInputError } from '../errors';

export class ListOrders {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: ListOrdersInput): Promise<PaginatedResult<OrderSummaryResult>> {
    // Validate pagination parameters
    if (input.page < 1) {
      throw new InvalidOrderInputError('Page must be greater than 0');
    }

    if (input.limit < 1 || input.limit > 100) {
      throw new InvalidOrderInputError('Limit must be between 1 and 100');
    }

    // Validate date range
    if (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo) {
      throw new InvalidOrderInputError('dateFrom must be before dateTo');
    }

    // Execute repository query
    const result = await this.orderRepository.list({
      customerId: input.customerId,
      status: input.status,
      statuses: input.statuses,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      search: input.search,
      page: input.page,
      limit: input.limit,
      sortBy: input.sortBy || 'createdAt',
      sortOrder: input.sortOrder || 'desc',
    });

    // Map orders to summary results
    const data = result.orders.map((order) => this.mapOrderToSummary(order));

    return {
      data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  private mapOrderToSummary(order: any): OrderSummaryResult {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      status: order.status,
      grandTotal: order.grandTotal,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
