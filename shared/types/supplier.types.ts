/**
 * Supplier management types
 * Supported suppliers: Aca Lighting, Masterled, Arelux, Braytron, FSL
 */

import { BaseEntity, Currency } from './common.types';

/**
 * Supplier entity
 */
export interface Supplier extends BaseEntity {
  /** Supplier name */
  name: string;
  /** Supplier code/identifier */
  code: string;
  /** Supplier type (manufacturer, distributor, wholesaler) */
  type: string;
  /** Company name */
  companyName: string;
  /** Contact person name */
  contactName: string;
  /** Contact email */
  contactEmail: string;
  /** Contact phone */
  contactPhone: string;
  /** Address */
  address: string;
  /** City */
  city: string;
  /** Zip code */
  zipCode: string;
  /** Country */
  country: string;
  /** VAT number */
  vatNumber?: string | null;
  /** Registration number */
  registrationNumber?: string | null;
  /** Bank IBAN */
  bankIban?: string | null;
  /** Bank account owner */
  bankAccountOwner?: string | null;
  /** Website URL */
  website?: string | null;
  /** API endpoint for integration */
  apiEndpoint?: string | null;
  /** API key for integration */
  apiKey?: string | null;
  /** API secret (encrypted) */
  apiSecret?: string | null;
  /** Default currency (RON) */
  currency: Currency;
  /** Payment terms (days) */
  paymentTermsDays: number;
  /** Minimum order amount */
  minimumOrderAmount: number;
  /** Default lead time in days */
  defaultLeadTimeDays: number;
  /** Whether supplier is active */
  isActive: boolean;
  /** Whether supplier has API integration */
  hasApiIntegration: boolean;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Average supplier rating (quality, delivery, etc.) */
  averageRating?: number | null;
  /** Number of successful orders */
  successfulOrders: number;
  /** Number of problematic deliveries */
  problematicDeliveries: number;
  /** Notes/comments */
  notes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Supplier product/SKU
 */
export interface SupplierProduct extends BaseEntity {
  /** Supplier ID */
  supplierId: number;
  /** Supplier's product code/SKU */
  supplierSku: string;
  /** Supplier's product name */
  productName: string;
  /** Supplier's product description */
  description?: string | null;
  /** Brand */
  brand?: string | null;
  /** Category */
  category?: string | null;
  /** List price (supplier's price) */
  listPrice: number;
  /** Supplier's cost/wholesale price */
  unitPrice: number;
  /** Currency */
  currency: Currency;
  /** Minimum order quantity */
  minimumOrderQuantity: number;
  /** Order increment quantity */
  orderIncrement: number;
  /** Lead time in days */
  leadTimeDays: number;
  /** Whether product is available */
  isAvailable: boolean;
  /** Supplier stock level */
  supplierStock: number;
  /** Last price update */
  lastPriceUpdateAt?: Date | null;
  /** Last stock update */
  lastStockUpdateAt?: Date | null;
  /** Product image URL */
  imageUrl?: string | null;
  /** Product data sheet/specifications */
  specifications?: Record<string, unknown> | null;
  /** Whether product is discontinued by supplier */
  isDiscontinued: boolean;
  /** Replacement product SKU */
  replacementSku?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Mapping between internal product SKU and supplier SKU
 */
export interface SupplierSkuMapping extends BaseEntity {
  /** Product ID */
  productId: number;
  /** Internal product SKU */
  sku: string;
  /** Supplier ID */
  supplierId: number;
  /** Supplier's SKU */
  supplierSku: string;
  /** Supplier's product ID in their system */
  supplierProductId?: string | null;
  /** Whether this is the preferred supplier */
  isPreferred: boolean;
  /** Priority order (lower number = higher priority) */
  priority: number;
  /** Conversion factor (if units differ) */
  conversionFactor: number;
  /** Whether mapping is active */
  isActive: boolean;
  /** Notes about mapping */
  notes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Purchase order sent to supplier
 */
export interface SupplierPurchaseOrder extends BaseEntity {
  /** Purchase order number */
  poNumber: string;
  /** Supplier ID */
  supplierId: number;
  /** Supplier reference number */
  supplierReferenceNumber?: string | null;
  /** Order status (pending, confirmed, shipped, received, etc.) */
  status: string;
  /** Order date */
  orderDate: Date;
  /** Expected delivery date */
  expectedDeliveryDate: Date;
  /** Actual delivery date */
  deliveryDate?: Date | null;
  /** Subtotal in RON */
  subtotal: number;
  /** VAT amount */
  vat: number;
  /** Total amount */
  total: number;
  /** Currency */
  currency: Currency;
  /** Payment status */
  paymentStatus: 'pending' | 'partial' | 'paid';
  /** Amount paid */
  amountPaid: number;
  /** Notes */
  notes?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Purchase order line item
 */
export interface SupplierPurchaseOrderItem extends BaseEntity {
  /** Purchase order ID */
  purchaseOrderId: number;
  /** Line item number */
  lineNumber: number;
  /** Product ID */
  productId: number;
  /** Internal SKU */
  sku: string;
  /** Supplier SKU */
  supplierSku: string;
  /** Quantity ordered */
  quantity: number;
  /** Quantity received */
  quantityReceived: number;
  /** Unit price from supplier */
  unitPrice: number;
  /** Line total (quantity * unitPrice) */
  lineTotal: number;
  /** Notes */
  notes?: string | null;
}

/**
 * Stock sync log with supplier
 */
export interface SupplierSyncLog extends BaseEntity {
  /** Supplier ID */
  supplierId: number;
  /** Supplier name */
  supplierName: string;
  /** Sync type (prices, stock, products, orders) */
  syncType: 'prices' | 'stock' | 'products' | 'orders' | 'all';
  /** Total items synced */
  totalItems: number;
  /** Successfully synced items */
  successCount: number;
  /** Failed items */
  failureCount: number;
  /** Sync status */
  status: 'success' | 'partial' | 'failed';
  /** Error message if failed */
  errorMessage?: string | null;
  /** API response (truncated if large) */
  responseData?: Record<string, unknown> | null;
  /** User who initiated sync */
  initiatedByUserId: number;
  /** Duration of sync in milliseconds */
  durationMs: number;
  /** Next scheduled sync */
  nextSyncAt?: Date | null;
  /** Detailed sync results */
  details?: {
    created?: number;
    updated?: number;
    deleted?: number;
    errors?: Array<{ item: string; error: string }>;
  } | null;
}

/**
 * DTO for creating a supplier
 */
export interface CreateSupplierDTO {
  name: string;
  code: string;
  type: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  vatNumber?: string;
  registrationNumber?: string;
  bankIban?: string;
  bankAccountOwner?: string;
  website?: string;
  paymentTermsDays: number;
  minimumOrderAmount: number;
  defaultLeadTimeDays: number;
  apiEndpoint?: string;
  apiKey?: string;
  apiSecret?: string;
  notes?: string;
}

/**
 * DTO for updating supplier
 */
export interface UpdateSupplierDTO {
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  paymentTermsDays?: number;
  minimumOrderAmount?: number;
  defaultLeadTimeDays?: number;
  isActive?: boolean;
  notes?: string;
}

/**
 * DTO for supplier SKU mapping
 */
export interface CreateSupplierSkuMappingDTO {
  productId: number;
  supplierId: number;
  supplierSku: string;
  supplierProductId?: string;
  isPreferred?: boolean;
  priority?: number;
  conversionFactor?: number;
  notes?: string;
}

/**
 * DTO for purchase order
 */
export interface CreateSupplierPurchaseOrderDTO {
  supplierId: number;
  expectedDeliveryDate: Date;
  items: {
    productId: number;
    quantity: number;
    supplierSku: string;
    unitPrice?: number;
  }[];
  notes?: string;
}
