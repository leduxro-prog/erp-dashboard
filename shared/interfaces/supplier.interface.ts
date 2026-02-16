import { Supplier } from '../types';

/**
 * Result of supplier stock scraping
 */
export interface ScrapeResult {
  supplierId: number;
  timestamp: Date;
  itemsScraped: number;
  itemsUpdated: number;
  itemsAdded: number;
  errors: {
    sku: string;
    error: string;
  }[];
  status: 'success' | 'partial' | 'failed';
  duration: number; // in milliseconds
}

/**
 * Mapping between supplier SKU and product ID
 */
export interface SupplierSkuMapping {
  id: number;
  supplierId: number;
  supplierSku: string;
  productId: number;
  supplierProductName: string;
  lastSynced: Date;
  active: boolean;
}

/**
 * Product information from supplier
 */
export interface SupplierProduct {
  supplierId: number;
  supplierSku: string;
  productName: string;
  description?: string;
  unitPrice: number;
  currency: string;
  stock: number;
  moq?: number; // Minimum Order Quantity
  leadTime?: number; // in days
  lastUpdated: Date;
  mappedProductId?: number;
}

/**
 * Item to order from supplier
 */
export interface SupplierOrderItem {
  supplierSku: string;
  quantity: number;
  unitPrice?: number;
}

/**
 * Result of placing supplier order
 */
export interface SupplierOrderResult {
  supplierId: number;
  orderReference: string;
  orderedItems: {
    supplierSku: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  taxes?: number;
  shippingCost?: number;
  total: number;
  estimatedDeliveryDate?: Date;
  supplierOrderId?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
}

/**
 * Supplier service interface for managing suppliers and stock synchronization
 */
export interface ISupplierService {
  /**
   * Get supplier details by ID
   * @param supplierId - Supplier ID
   * @returns Supplier information
   */
  getSupplier(supplierId: number): Promise<Supplier>;

  /**
   * List all active suppliers
   * @returns Array of suppliers
   */
  listSuppliers(): Promise<Supplier[]>;

  /**
   * Scrape stock information from a specific supplier
   * @param supplierId - Supplier ID
   * @returns Scrape result with sync details
   */
  scrapeSupplierStock(supplierId: number): Promise<ScrapeResult>;

  /**
   * Scrape stock from all configured suppliers
   * @returns Array of scrape results
   */
  scrapeAllSuppliers(): Promise<ScrapeResult[]>;

  /**
   * Map supplier SKU to product ID
   * @param supplierId - Supplier ID
   * @param supplierSku - Supplier's SKU
   * @param productId - Our product ID
   * @returns Created mapping
   */
  mapSku(
    supplierId: number,
    supplierSku: string,
    productId: number,
  ): Promise<SupplierSkuMapping>;

  /**
   * Get products available from a supplier
   * @param supplierId - Supplier ID
   * @returns Array of supplier products
   */
  getSupplierProducts(supplierId: number): Promise<SupplierProduct[]>;

  /**
   * Place an order with supplier
   * @param supplierId - Supplier ID
   * @param items - Items to order
   * @returns Order result with reference
   */
  placeSupplierOrder(
    supplierId: number,
    items: SupplierOrderItem[],
  ): Promise<SupplierOrderResult>;
}
