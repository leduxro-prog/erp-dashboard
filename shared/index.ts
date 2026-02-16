/**
 * Shared Module Exports
 * Central export point for shared utilities, types, constants, and errors
 * Includes scalability layer for handling 100K+ products, 500+ clients
 */

// Errors
export * from './errors';

// Types
export * from './types';

// Constants
export {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  isValidTransition,
  getNextStatuses,
  getOrderStatusLabel,
  getAllOrderStatuses,
  isTerminalStatus,
  isQuoteStatus,
  isFulfillmentStatus,
  isPaymentStatus,
  isOrderModifiable,
  isOrderCompleted,
  MARGINS,
  PricingTier,
  PRICING_TIER_LABELS,
  PRICING_TIER_CONFIG,
  VOLUME_DISCOUNT_BRACKETS,
  getTierDiscountPercent,
  getTierMinMonthlySpend,
  getVolumeDiscountPercent,
  getVolumeDiscountBracket,
  determineBestTier,
  calculateDiscountedPrice,
  getTotalDiscountPercent,
  addVAT,
  removeVAT,
  applyMargin,
  isAcceptableMargin,
  getPricingTierLabel,
  getPricingTierDescription,
  getAllPricingTiers,
  // Error Codes
  ERROR_GENERAL_INTERNAL_SERVER_ERROR,
  ERROR_GENERAL_NOT_FOUND,
  ERROR_GENERAL_UNAUTHORIZED,
  ERROR_GENERAL_FORBIDDEN,
  ERROR_GENERAL_CONFLICT,
  ERROR_GENERAL_RATE_LIMIT,
  ERROR_GENERAL_SERVICE_UNAVAILABLE,
  ERROR_GENERAL_TIMEOUT,
  ERROR_AUTH_INVALID_CREDENTIALS,
  ERROR_AUTH_USER_NOT_FOUND,
  ERROR_AUTH_USER_DISABLED,
  ERROR_AUTH_SESSION_EXPIRED,
  ERROR_AUTH_TOKEN_INVALID,
  ERROR_AUTH_INSUFFICIENT_PERMISSIONS,
  ERROR_AUTH_ACCOUNT_LOCKED,
  ERROR_VALIDATION_INVALID_INPUT,
  ERROR_VALIDATION_MISSING_FIELD,
  ERROR_VALIDATION_INVALID_EMAIL,
  ERROR_VALIDATION_INVALID_PHONE,
  ERROR_VALIDATION_INVALID_FORMAT,
  ERROR_VALIDATION_DUPLICATE_ENTRY,
  ERROR_VALIDATION_OUT_OF_RANGE,
  ERROR_PRODUCT_NOT_FOUND,
  ERROR_PRODUCT_INACTIVE,
  ERROR_PRODUCT_INVALID_SKU,
  ERROR_PRODUCT_INVALID_CATEGORY,
  ERROR_PRODUCT_MISSING_PRICE,
  ERROR_PRODUCT_SYNC_FAILED,
  ERROR_INVENTORY_OUT_OF_STOCK,
  ERROR_INVENTORY_INSUFFICIENT_STOCK,
  ERROR_INVENTORY_NEGATIVE_QUANTITY,
  ERROR_INVENTORY_UPDATE_FAILED,
  ERROR_INVENTORY_RESERVED_CONFLICT,
  ERROR_ORDER_NOT_FOUND,
  ERROR_ORDER_INVALID_STATUS,
  ERROR_ORDER_INVALID_TRANSITION,
  ERROR_ORDER_EMPTY,
  ERROR_ORDER_CUSTOMER_NOT_FOUND,
  ERROR_ORDER_CANNOT_CANCEL,
  ERROR_ORDER_CANNOT_MODIFY,
  ERROR_ORDER_ITEM_NOT_FOUND,
  ERROR_QUOTE_NOT_FOUND,
  ERROR_QUOTE_EXPIRED,
  ERROR_QUOTE_ALREADY_ACCEPTED,
  ERROR_QUOTE_INVALID_VALIDITY,
  ERROR_QUOTE_CONVERSION_FAILED,
  ERROR_PRICING_INVALID_AMOUNT,
  ERROR_PRICING_UNACCEPTABLE_MARGIN,
  ERROR_PRICING_CALCULATION_FAILED,
  ERROR_PRICING_COST_PRICE_MISSING,
  ERROR_PRICING_INVALID_DISCOUNT,
  ERROR_SUPPLIER_NOT_FOUND,
  ERROR_SUPPLIER_INACTIVE,
  ERROR_SUPPLIER_ORDER_FAILED,
  ERROR_SUPPLIER_API_ERROR,
  ERROR_SUPPLIER_COMMUNICATION_ERROR,
  ERROR_SMARTBILL_API_ERROR,
  ERROR_SMARTBILL_INVOICE_FAILED,
  ERROR_SMARTBILL_AUTHENTICATION_FAILED,
  ERROR_SMARTBILL_INVALID_CUSTOMER,
  ERROR_SMARTBILL_NETWORK_ERROR,
  ERROR_WOOCOMMERCE_API_ERROR,
  ERROR_WOOCOMMERCE_SYNC_FAILED,
  ERROR_WOOCOMMERCE_PRODUCT_SYNC_FAILED,
  ERROR_WOOCOMMERCE_ORDER_SYNC_FAILED,
  ERROR_WOOCOMMERCE_AUTHENTICATION_FAILED,
  ERROR_WOOCOMMERCE_NETWORK_ERROR,
  ErrorCodeDef,
  getErrorCodeDef,
  getErrorCodeByKey,
  getErrorMessage,
  getErrorMessageByKey,
  getErrorHttpStatus,
  getAllErrorCodes,
  getErrorCodesByCategory,
} from './constants';

// Status Mapping (cross-system translations)
export {
  // Note: ErpOrderStatus is an alias for OrderStatus from order-statuses.ts
  // Do NOT import both OrderStatus (from types) and ErpOrderStatus (from constants)
  // in the same scope — they are the same type.
  WooCommerceOrderStatus,
  SmartBillInvoiceStatus,
  B2BPortalOrderStatus,
  ErpInvoiceStatus,
  ErpPaymentStatus,
  mapWooOrderToErp,
  mapErpOrderToWoo,
  mapErpOrderToPortal,
  mapSmartBillInvoiceToErp,
  mapErpInvoiceToSmartBill,
  mapSmartBillToPaymentStatus,
  isSmartBillInvoiceFinal,
  isErpOrderTerminal,
} from './constants';

// Interfaces
export {
  IPricingService,
  TierPricingInfo,
  OrderPriceCalculation,
  IInventoryService,
  ReserveStockItem,
  ReservationResult,
  SyncResult,
  IOrderService,
  // PartialDeliveryItem, // Conflict with types
  Invoice,
  // ProformaInvoice, // Conflict with types
  IQuotationService,
  // QuoteFilters, // Conflict with types
  ISupplierService,
  ScrapeResult,
  // SupplierSkuMapping, // Conflict with types
  // SupplierProduct, // Conflict with types
  // SupplierOrderItem, // Conflict with types
  SupplierOrderResult,
  INotificationService,
  EmailAttachment,
  InternalAlert,
  // NotificationPayload, // Conflict with types
  ISmartBillService,
  SmartBillSyncResult,
  SmartBillInvoiceResult,
  SmartBillProformaResult,
  SmartBillWarehouse,
  SmartBillProduct,
  IWooCommerceService,
  WooSyncResult,
  WooPulledOrder,
  IEventPublisher,
  IAuditLogger,
  AuditEvent,
  AuditChanges,
} from './interfaces';

// Events
export * from './events';

// Module System (plugin framework)
export * from './module-system';

// API Integration Module (multi-API adapter system)
export {
  ApiClient,
  // ApiResponse, // Conflict with types
  ApiRequest,
  BatchResponse,
  ApiClientHealth,
  ApiClientMetrics,
  IApiClient,
  ApiClientConfig,
  ApiClientFactory,
  ApiHealthReport,
  TokenBucketRateLimiter,
  TokenBucketConfig,
  RateLimiterMetrics,
  ApiRegistry,
  ApiAuthConfig,
  ApiConfig,
  WebhookManager,
  WebhookResult,
  WebhookHandler,
  WebhookValidation,
  DeadLetterEntry,
} from './api';

// Cache module (L1/L2/L3 multi-layer caching)
export * from './cache';

// Database optimizations
export * from './database';

// Response utilities (selective export)
export { successResponse, errorResponse, paginatedResponse } from './utils/response';

// Batch processing utilities
export {
  BatchProcessor,
  type BatchProcessorOptions,
  type BatchProgress,
  type BatchResult,
} from './utils/batch-processor';

// Stream processing utilities
export {
  StreamProcessor,
  type CSVExportOptions,
  type JSONExportOptions,
  type CSVImportOptions,
} from './utils/stream-processor';
