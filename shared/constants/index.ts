/**
 * Shared Constants Export
 * Central export point for all CYPHER ERP shared constants
 */

// Order Statuses
export {
  OrderStatus,
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
} from './order-statuses';

// Pricing Tiers
export {
  VAT_RATE,
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
} from './pricing-tiers';

// Error Codes
export {
  // General Errors
  ERROR_GENERAL_INTERNAL_SERVER_ERROR,
  ERROR_GENERAL_NOT_FOUND,
  ERROR_GENERAL_UNAUTHORIZED,
  ERROR_GENERAL_FORBIDDEN,
  ERROR_GENERAL_CONFLICT,
  ERROR_GENERAL_RATE_LIMIT,
  ERROR_GENERAL_SERVICE_UNAVAILABLE,
  ERROR_GENERAL_TIMEOUT,
  // Auth Errors
  ERROR_AUTH_INVALID_CREDENTIALS,
  ERROR_AUTH_USER_NOT_FOUND,
  ERROR_AUTH_USER_DISABLED,
  ERROR_AUTH_SESSION_EXPIRED,
  ERROR_AUTH_TOKEN_INVALID,
  ERROR_AUTH_INSUFFICIENT_PERMISSIONS,
  ERROR_AUTH_ACCOUNT_LOCKED,
  // Validation Errors
  ERROR_VALIDATION_INVALID_INPUT,
  ERROR_VALIDATION_MISSING_FIELD,
  ERROR_VALIDATION_INVALID_EMAIL,
  ERROR_VALIDATION_INVALID_PHONE,
  ERROR_VALIDATION_INVALID_FORMAT,
  ERROR_VALIDATION_DUPLICATE_ENTRY,
  ERROR_VALIDATION_OUT_OF_RANGE,
  // Product Errors
  ERROR_PRODUCT_NOT_FOUND,
  ERROR_PRODUCT_INACTIVE,
  ERROR_PRODUCT_INVALID_SKU,
  ERROR_PRODUCT_INVALID_CATEGORY,
  ERROR_PRODUCT_MISSING_PRICE,
  ERROR_PRODUCT_SYNC_FAILED,
  // Inventory Errors
  ERROR_INVENTORY_OUT_OF_STOCK,
  ERROR_INVENTORY_INSUFFICIENT_STOCK,
  ERROR_INVENTORY_NEGATIVE_QUANTITY,
  ERROR_INVENTORY_UPDATE_FAILED,
  ERROR_INVENTORY_RESERVED_CONFLICT,
  // Order Errors
  ERROR_ORDER_NOT_FOUND,
  ERROR_ORDER_INVALID_STATUS,
  ERROR_ORDER_INVALID_TRANSITION,
  ERROR_ORDER_EMPTY,
  ERROR_ORDER_CUSTOMER_NOT_FOUND,
  ERROR_ORDER_CANNOT_CANCEL,
  ERROR_ORDER_CANNOT_MODIFY,
  ERROR_ORDER_ITEM_NOT_FOUND,
  // Quote Errors
  ERROR_QUOTE_NOT_FOUND,
  ERROR_QUOTE_EXPIRED,
  ERROR_QUOTE_ALREADY_ACCEPTED,
  ERROR_QUOTE_INVALID_VALIDITY,
  ERROR_QUOTE_CONVERSION_FAILED,
  // Pricing Errors
  ERROR_PRICING_INVALID_AMOUNT,
  ERROR_PRICING_UNACCEPTABLE_MARGIN,
  ERROR_PRICING_CALCULATION_FAILED,
  ERROR_PRICING_COST_PRICE_MISSING,
  ERROR_PRICING_INVALID_DISCOUNT,
  // Supplier Errors
  ERROR_SUPPLIER_NOT_FOUND,
  ERROR_SUPPLIER_INACTIVE,
  ERROR_SUPPLIER_ORDER_FAILED,
  ERROR_SUPPLIER_API_ERROR,
  ERROR_SUPPLIER_COMMUNICATION_ERROR,
  // SmartBill Errors
  ERROR_SMARTBILL_API_ERROR,
  ERROR_SMARTBILL_INVOICE_FAILED,
  ERROR_SMARTBILL_AUTHENTICATION_FAILED,
  ERROR_SMARTBILL_INVALID_CUSTOMER,
  ERROR_SMARTBILL_NETWORK_ERROR,
  // WooCommerce Errors
  ERROR_WOOCOMMERCE_API_ERROR,
  ERROR_WOOCOMMERCE_SYNC_FAILED,
  ERROR_WOOCOMMERCE_PRODUCT_SYNC_FAILED,
  ERROR_WOOCOMMERCE_ORDER_SYNC_FAILED,
  ERROR_WOOCOMMERCE_AUTHENTICATION_FAILED,
  ERROR_WOOCOMMERCE_NETWORK_ERROR,
  // Types and Utilities
  ErrorCodeDef,
  getErrorCodeDef,
  getErrorCodeByKey,
  getErrorMessage,
  getErrorMessageByKey,
  getErrorHttpStatus,
  getAllErrorCodes,
  getErrorCodesByCategory,
} from './error-codes';

// Status Mapping (cross-system: ERP <-> WooCommerce <-> SmartBill <-> B2B Portal)
export {
  // Re-exported OrderStatus alias
  ErpOrderStatus,
  // External system types
  WooCommerceOrderStatus,
  SmartBillInvoiceStatus,
  B2BPortalOrderStatus,
  ErpInvoiceStatus,
  ErpPaymentStatus,
  // Mapper functions
  mapWooOrderToErp,
  mapErpOrderToWoo,
  mapErpOrderToPortal,
  mapSmartBillInvoiceToErp,
  mapErpInvoiceToSmartBill,
  mapSmartBillToPaymentStatus,
  // Status checks
  isSmartBillInvoiceFinal,
  isErpOrderTerminal,
} from './status-mapping';
