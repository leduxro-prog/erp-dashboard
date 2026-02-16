/**
 * Result of SmartBill stock synchronization
 */
export interface SmartBillSyncResult {
  timestamp: Date;
  warehousesScanned: number;
  itemsSynced: number;
  itemsUpdated: number;
  itemsAdded: number;
  errors: {
    warehouseId: string;
    error: string;
  }[];
  status: 'success' | 'partial' | 'failed';
  duration: number; // in milliseconds
}

/**
 * Invoice creation result from SmartBill
 */
export interface SmartBillInvoiceResult {
  orderId: number;
  invoiceNumber: string;
  smartBillInvoiceId: string;
  invoiceDate: Date;
  total: number;
  currency: string;
  pdfUrl?: string;
  status: 'created' | 'failed';
  message?: string;
  smartBillResponse?: Record<string, unknown>;
}

/**
 * Proforma invoice creation result from SmartBill
 */
export interface SmartBillProformaResult {
  orderId: number;
  proformaNumber: string;
  smartBillProformaId: string;
  issueDate: Date;
  validUntil: Date;
  total: number;
  currency: string;
  pdfUrl?: string;
  status: 'created' | 'failed';
  message?: string;
  smartBillResponse?: Record<string, unknown>;
}

/**
 * Warehouse information from SmartBill
 */
export interface SmartBillWarehouse {
  warehouseId: string;
  name: string;
  address?: string;
  city?: string;
  isDefault: boolean;
  isActive: boolean;
}

/**
 * Product information from SmartBill
 */
export interface SmartBillProduct {
  smartBillProductId: string;
  productName: string;
  code: string;
  warehouseId: string;
  stock: number;
  unitOfMeasure: string;
  currency: string;
  price: number;
  lastUpdated: Date;
}

/**
 * SmartBill integration service interface
 * Handles synchronization and document generation with SmartBill
 */
export interface ISmartBillService {
  /**
   * Synchronize stock from SmartBill to local database
   * @returns Synchronization result with details
   */
  syncStock(): Promise<SmartBillSyncResult>;

  /**
   * Create invoice in SmartBill for an order
   * @param orderId - Order ID
   * @returns Invoice creation result
   */
  createInvoice(orderId: number): Promise<SmartBillInvoiceResult>;

  /**
   * Create proforma invoice in SmartBill for an order
   * @param orderId - Order ID
   * @returns Proforma invoice creation result
   */
  createProforma(orderId: number): Promise<SmartBillProformaResult>;

  /**
   * Get list of warehouses from SmartBill
   * @returns Array of warehouse information
   */
  getWarehouses(): Promise<SmartBillWarehouse[]>;

  /**
   * Get products from specific SmartBill warehouse
   * @param warehouseId - Warehouse ID
   * @returns Array of products in warehouse
   */
  getProducts(warehouseId: string): Promise<SmartBillProduct[]>;
}
