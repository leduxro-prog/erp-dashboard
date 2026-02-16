/**
 * Result of WooCommerce synchronization
 */
export interface WooSyncResult {
  itemsSynced: number;
  itemsUpdated: number;
  itemsAdded: number;
  errors: {
    productId: number | string;
    error: string;
  }[];
  status: 'success' | 'partial' | 'failed';
  timestamp: Date;
  duration: number; // in milliseconds
}

/**
 * Order pulled from WooCommerce
 */
export interface WooPulledOrder {
  wooOrderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: {
    productId: number;
    productName: string;
    sku?: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  taxes: number;
  shippingCost: number;
  discounts: number;
  total: number;
  status: string;
  paymentMethod?: string;
  orderDate: Date;
  shippingAddress?: {
    name: string;
    phone?: string;
    address: string;
    city: string;
    state?: string;
    postcode?: string;
    country: string;
  };
  notes?: string;
  imported: boolean;
  importedAt?: Date;
}

/**
 * WooCommerce integration service interface
 * Handles synchronization of products, stock, pricing, and orders
 */
export interface IWooCommerceService {
  /**
   * Synchronize single product to WooCommerce
   * @param productId - Our product ID
   * @returns Synchronization result
   */
  syncProduct(productId: number): Promise<WooSyncResult>;

  /**
   * Synchronize all products to WooCommerce
   * @returns Synchronization result
   */
  syncAllProducts(): Promise<WooSyncResult>;

  /**
   * Synchronize product stock to WooCommerce
   * @param productId - Our product ID
   * @returns Synchronization result
   */
  syncStock(productId: number): Promise<WooSyncResult>;

  /**
   * Synchronize product price to WooCommerce
   * @param productId - Our product ID
   * @returns Synchronization result
   */
  syncPrice(productId: number): Promise<WooSyncResult>;

  /**
   * Synchronize product categories to WooCommerce
   * @returns Synchronization result
   */
  syncCategories(): Promise<WooSyncResult>;

  /**
   * Pull orders from WooCommerce
   * @param since - Optional date to pull orders since
   * @returns Array of pulled orders
   */
  pullOrders(since?: Date): Promise<WooPulledOrder[]>;
}
