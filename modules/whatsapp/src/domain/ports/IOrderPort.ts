/**
 * Order Port Interface
 *
 * Defines the contract for querying order data.
 * Implementation is provided by the order module.
 *
 * @module whatsapp/domain/ports
 */

/**
 * Order domain object (minimal interface).
 * Only includes fields needed for WhatsApp notifications.
 */
export interface Order {
  id: string;
  number: string;
  customerId: string;
  status:
    | 'quote_pending'
    | 'quote_sent'
    | 'order_confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  totalAmount: number;
  currency: string;
  deliveryDate?: Date;
  shippingAddress: string;
  items: OrderItem[];
}

/**
 * Order item within an order.
 */
export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Order Port Interface.
 *
 * Port for querying order information from the order domain.
 * Encapsulates inter-module communication.
 *
 * @interface IOrderPort
 */
export interface IOrderPort {
  /**
   * Find an order by ID.
   *
   * @param orderId - Order ID
   * @returns Promise resolving to order or null if not found
   * @throws {Error} On database or service errors
   */
  findById(orderId: string): Promise<Order | null>;

  /**
   * Find orders by customer ID.
   *
   * @param customerId - Customer ID
   * @param limit - Maximum number to return (default: 10)
   * @returns Promise resolving to array of orders
   * @throws {Error} On database or service errors
   */
  findByCustomerId(customerId: string, limit?: number): Promise<Order[]>;

  /**
   * Find orders in a specific status.
   *
   * @param status - Order status
   * @param limit - Maximum number to return (default: 10)
   * @returns Promise resolving to array of orders
   * @throws {Error} On database or service errors
   */
  findByStatus(status: Order['status'], limit?: number): Promise<Order[]>;
}
