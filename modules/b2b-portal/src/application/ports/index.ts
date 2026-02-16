/**
 * Application Ports (External Service Interfaces)
 * Define contracts for external services integrated with the B2B Portal module.
 *
 * @module B2B Portal - Application Ports
 */

/**
 * Order creation result
 */
export interface Order {
  id: string;
  customerId: string;
  totalAmount: number;
  itemCount: number;
  status: string;
  createdAt: Date;
}

/**
 * IOrderPort: Create orders
 * Implemented by Order Management module
 */
export interface IOrderPort {
  /**
   * Create an order from cart items
   */
  createOrder(data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    notes?: string;
  }): Promise<Order>;
}

/**
 * IPricingPort: Get pricing information
 * Implemented by Pricing Engine module
 */
export interface IPricingPort {
  /**
   * Get tier-based discount for a customer
   */
  getCustomerTierDiscount(customerId: string): Promise<number>;

  /**
   * Get product price with all applicable discounts
   */
  getDiscountedPrice(
    productId: string,
    quantity: number,
    customerId?: string
  ): Promise<number>;
}

/**
 * Stock availability result
 */
export interface StockAvailability {
  sku: string;
  available: number;
  reserved: number;
}

/**
 * IInventoryPort: Check inventory
 * Implemented by Inventory module
 */
export interface IInventoryPort {
  /**
   * Check bulk stock for multiple SKUs
   */
  checkBulkStock(skus: string[]): Promise<Map<string, StockAvailability>>;

  /**
   * Verify stock for a single SKU
   */
  checkStock(sku: string): Promise<StockAvailability>;
}

/**
 * INotificationPort: Send notifications
 * Implemented by Notifications module
 */
export interface INotificationPort {
  /**
   * Send a notification to a user/customer
   */
  sendNotification(data: {
    type: string;
    recipientId: string;
    email?: string;
    subject?: string;
    message?: string;
    data?: unknown;
  }): Promise<void>;

  /**
   * Send bulk notifications
   */
  sendBulkNotifications(data: {
    type: string;
    recipients: Array<{
      id: string;
      email: string;
    }>;
    subject?: string;
    template?: string;
    data?: unknown;
  }): Promise<void>;
}

// End of exports
