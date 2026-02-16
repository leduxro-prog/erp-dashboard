/**
 * Order Port Interface
 * Inbound port for querying order data from other modules
 *
 * @module Application/Ports
 */

/**
 * Order data model
 */
export interface Order {
  id: string;
  customerId: string;
  total: number;
  discountApplied: number;
  createdAt: Date;
  items: Array<{
    productId: string;
    categoryId: string;
    quantity: number;
    amount: number;
  }>;
}

/**
 * IOrderPort
 * Port interface for querying order data
 * Implemented by orders module
 */
export interface IOrderPort {
  /**
   * Get orders for a customer
   * @param customerId - Customer ID
   * @param limit - Maximum number of orders to return
   * @returns Array of customer orders
   */
  getOrdersByCustomer(customerId: string, limit?: number): Promise<Order[]>;

  /**
   * Get order by ID
   * @param orderId - Order ID
   * @returns Order or null if not found
   */
  getOrderById(orderId: string): Promise<Order | null>;

  /**
   * Check if customer has made a purchase
   * @param customerId - Customer ID
   * @returns True if customer has orders
   */
  hasCustomerPurchased(customerId: string): Promise<boolean>;

  /**
   * Get total spent by customer
   * @param customerId - Customer ID
   * @returns Total amount spent
   */
  getTotalSpentByCustomer(customerId: string): Promise<number>;
}
