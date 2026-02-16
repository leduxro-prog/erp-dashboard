/**
 * Integration types for third-party systems
 * Integrations: SmartBill (invoicing), WooCommerce (frontend)
 */

import { BaseEntity } from './common.types';

/**
 * SmartBill sync types
 */
export const SmartBillSyncTypeEnum = {
  INVOICE: 'INVOICE',
  PROFORMA: 'PROFORMA',
  STOCK: 'STOCK',
  DELIVERY: 'DELIVERY',
  PAYMENT: 'PAYMENT',
} as const;

export type SmartBillSyncType = typeof SmartBillSyncTypeEnum[keyof typeof SmartBillSyncTypeEnum];

/**
 * WooCommerce sync types
 */
export const WooCommerceSyncTypeEnum = {
  PRODUCT: 'PRODUCT',
  PRICE: 'PRICE',
  STOCK: 'STOCK',
  CATEGORY: 'CATEGORY',
  IMAGES: 'IMAGES',
} as const;

export type WooCommerceSyncType = typeof WooCommerceSyncTypeEnum[keyof typeof WooCommerceSyncTypeEnum];

/**
 * SmartBill integration sync log
 */
export interface SmartBillSync extends BaseEntity {
  /** Sync type */
  syncType: SmartBillSyncType;
  /** Internal reference ID (order, invoice, etc.) */
  referenceId: number;
  /** Reference type (order, proforma_invoice, etc.) */
  referenceType: string;
  /** SmartBill document ID */
  smartBillDocId?: string | null;
  /** SmartBill document number */
  smartBillDocNumber?: string | null;
  /** Sync status (pending, success, failed, partial) */
  status: 'pending' | 'success' | 'failed' | 'partial';
  /** Error message if failed */
  errorMessage?: string | null;
  /** Number of sync attempts */
  attemptCount: number;
  /** Last sync attempt timestamp */
  lastAttemptAt?: Date | null;
  /** Request data sent to SmartBill */
  requestData?: Record<string, unknown> | null;
  /** Response data from SmartBill */
  responseData?: Record<string, unknown> | null;
  /** Sync response status code */
  responseStatusCode?: number | null;
  /** User ID who triggered sync */
  triggeredByUserId?: number | null;
  /** Retry count */
  retryCount: number;
  /** Next retry timestamp */
  nextRetryAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * WooCommerce integration sync log
 */
export interface WooCommerceSync extends BaseEntity {
  /** Sync type */
  syncType: WooCommerceSyncType;
  /** Product ID (for PRODUCT, PRICE, STOCK, IMAGES syncs) */
  productId?: number | null;
  /** Category ID (for CATEGORY sync) */
  categoryId?: number | null;
  /** WooCommerce product ID */
  wooCommerceProductId?: number | null;
  /** WooCommerce category ID */
  wooCommerceCategoryId?: number | null;
  /** Sync status (pending, success, failed, partial) */
  status: 'pending' | 'success' | 'failed' | 'partial';
  /** Error message if failed */
  errorMessage?: string | null;
  /** Number of sync attempts */
  attemptCount: number;
  /** Last sync attempt timestamp */
  lastAttemptAt?: Date | null;
  /** Request data sent to WooCommerce */
  requestData?: Record<string, unknown> | null;
  /** Response data from WooCommerce */
  responseData?: Record<string, unknown> | null;
  /** HTTP response status code */
  responseStatusCode?: number | null;
  /** User ID who triggered sync */
  triggeredByUserId?: number | null;
  /** Retry count */
  retryCount: number;
  /** Next retry timestamp */
  nextRetryAt?: Date | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * SmartBill configuration
 */
export interface SmartBillConfig extends BaseEntity {
  /** API token/key (encrypted) */
  apiToken: string;
  /** API password (encrypted) */
  apiPassword: string;
  /** Sandbox mode */
  isSandbox: boolean;
  /** Company/entity ID in SmartBill */
  companyId?: string | null;
  /** Default document series for invoices */
  defaultInvoiceSeries?: string | null;
  /** Default document series for proforma invoices */
  defaultProformaSeries?: string | null;
  /** Enable automatic invoice creation */
  autoCreateInvoices: boolean;
  /** Enable automatic stock sync */
  autoSyncStock: boolean;
  /** Auto sync interval in minutes */
  autoSyncIntervalMinutes: number;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Configuration status (active, inactive, error) */
  status: 'active' | 'inactive' | 'error';
  /** Last error message */
  lastErrorMessage?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * WooCommerce configuration
 */
export interface WooCommerceConfig extends BaseEntity {
  /** Store URL */
  storeUrl: string;
  /** Consumer key (encrypted) */
  consumerKey: string;
  /** Consumer secret (encrypted) */
  consumerSecret: string;
  /** Enable automatic price sync */
  autoSyncPrices: boolean;
  /** Enable automatic stock sync */
  autoSyncStock: boolean;
  /** Auto sync interval in minutes */
  autoSyncIntervalMinutes: number;
  /** Sync featured products only */
  syncFeaturedOnly: boolean;
  /** Include product images in sync */
  syncImages: boolean;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Configuration status (active, inactive, error) */
  status: 'active' | 'inactive' | 'error';
  /** Last error message */
  lastErrorMessage?: string | null;
  /** Metadata JSON */
  metadata?: Record<string, unknown> | null;
}

/**
 * Invoice sync to SmartBill
 */
export interface SmartBillInvoiceSync extends BaseEntity {
  /** Order ID */
  orderId: number;
  /** SmartBill document ID */
  smartBillDocId?: string | null;
  /** SmartBill document series */
  docSeries?: string | null;
  /** SmartBill document number */
  docNumber?: string | null;
  /** Invoice date in SmartBill */
  invoiceDate?: Date | null;
  /** Sync status */
  status: 'pending' | 'synced' | 'failed';
  /** Retry count */
  retryCount: number;
  /** Last error */
  lastError?: string | null;
  /** Last sync attempt */
  lastAttemptAt?: Date | null;
}

/**
 * Product sync mapping with WooCommerce
 */
export interface WooCommerceProductMap extends BaseEntity {
  /** Product ID */
  productId: number;
  /** Product SKU */
  sku: string;
  /** WooCommerce product ID */
  wooProductId: number;
  /** WooCommerce product slug */
  wooProductSlug: string;
  /** Sync status (synced, pending, failed) */
  syncStatus: 'synced' | 'pending' | 'failed';
  /** Last synced data hash */
  lastSyncHash?: string | null;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Last sync error */
  lastSyncError?: string | null;
  /** Manual price override (if set, won't be overridden by sync) */
  manualPriceOverride?: number | null;
}

/**
 * Category sync mapping with WooCommerce
 */
export interface WooCommerceCategoryMap extends BaseEntity {
  /** Category ID */
  categoryId: number;
  /** WooCommerce category ID */
  woCategoryId: number;
  /** WooCommerce category slug */
  woCategorySlug: string;
  /** Sync status */
  syncStatus: 'synced' | 'pending' | 'failed';
  /** Last synced data hash */
  lastSyncHash?: string | null;
  /** Last sync timestamp */
  lastSyncAt?: Date | null;
  /** Last sync error */
  lastSyncError?: string | null;
}

/**
 * API webhook event log
 */
export interface WebhookEvent extends BaseEntity {
  /** Event type */
  eventType: string;
  /** Source system (smartbill, woocommerce, etc.) */
  sourceSystem: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Processing status (pending, processed, failed) */
  status: 'pending' | 'processed' | 'failed';
  /** Error message if failed */
  errorMessage?: string | null;
  /** Processed at timestamp */
  processedAt?: Date | null;
  /** Retry count */
  retryCount: number;
}

/**
 * DTO for SmartBill sync configuration
 */
export interface ConfigureSmartBillDTO {
  apiToken: string;
  apiPassword: string;
  isSandbox?: boolean;
  companyId?: string;
  defaultInvoiceSeries?: string;
  defaultProformaSeries?: string;
  autoCreateInvoices?: boolean;
  autoSyncStock?: boolean;
  autoSyncIntervalMinutes?: number;
}

/**
 * DTO for WooCommerce sync configuration
 */
export interface ConfigureWooCommerceDTO {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  autoSyncPrices?: boolean;
  autoSyncStock?: boolean;
  autoSyncIntervalMinutes?: number;
  syncFeaturedOnly?: boolean;
  syncImages?: boolean;
}

/**
 * Sync status summary
 */
export interface SyncStatusSummary {
  /** SmartBill status */
  smartBillStatus: {
    connected: boolean;
    lastSync?: Date;
    pendingSyncs: number;
    failedSyncs: number;
  };
  /** WooCommerce status */
  wooCommerceStatus: {
    connected: boolean;
    lastSync?: Date;
    pendingSyncs: number;
    failedSyncs: number;
  };
  /** Overall sync health */
  health: 'healthy' | 'warning' | 'critical';
}

/**
 * Manual sync trigger request
 */
export interface ManualSyncRequest {
  /** System to sync (smartbill, woocommerce) */
  system: 'smartbill' | 'woocommerce';
  /** Sync type */
  syncType: string;
  /** Specific IDs to sync (optional) */
  targetIds?: number[];
  /** Force full resync */
  forceFullSync?: boolean;
}
