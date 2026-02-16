/**
 * Order Repository Interface
 * Abstraction for order data persistence
 */
import { Order, OrderStatus } from '../entities';
import { StatusChange } from '../entities/StatusChange';

export interface OrderListFilters {
  customerId?: number;
  status?: OrderStatus;
  statuses?: OrderStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string; // Search by order number, customer name, email
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'orderNumber' | 'customerName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderListResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IOrderRepository {
  /**
   * Create new order
   */
  create(order: Order): Promise<Order>;

  /**
   * Get order by ID
   */
  getById(id: number): Promise<Order | null>;

  /**
   * Get order by order number
   */
  getByOrderNumber(orderNumber: string): Promise<Order | null>;

  /**
   * Update existing order
   */
  update(order: Order): Promise<void>;

  /**
   * List orders with filters and pagination
   */
  list(filters: OrderListFilters): Promise<OrderListResult>;

  /**
   * Get orders by customer
   */
  getByCustomer(
    customerId: number,
    pagination: { page: number; limit: number }
  ): Promise<OrderListResult>;

  /**
   * Get orders by status (single or multiple)
   */
  getByStatus(status: OrderStatus | OrderStatus[]): Promise<Order[]>;

  /**
   * Get next sequential order number
   */
  getNextOrderNumber(): Promise<string>;

  /**
   * Add status change to history
   */
  addStatusHistory(orderId: number, change: StatusChange): Promise<void>;

  /**
   * Get status history for an order
   */
  getStatusHistory(orderId: number): Promise<StatusChange[]>;

  /**
   * Delete order (soft or hard depending on implementation)
   */
  delete(orderId: number): Promise<void>;

  /**
   * Check if order exists
   */
  exists(orderNumber: string): Promise<boolean>;
}
