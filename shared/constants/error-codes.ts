/**
 * Error Codes and Messages
 * Comprehensive error codes for the entire CYPHER ERP system
 * Organized by category with bilingual messages and HTTP status codes
 */

export interface ErrorCodeDef {
  code: number;
  key: string;
  httpStatus: number;
  messageRo: string;
  messageEn: string;
}

/**
 * Error code categories and ranges:
 * 0xxx - GENERAL errors
 * 1xxx - AUTH errors
 * 2xxx - VALIDATION errors
 * 3xxx - PRODUCT errors
 * 4xxx - INVENTORY errors
 * 5xxx - ORDER errors
 * 6xxx - QUOTE errors
 * 7xxx - PRICING errors
 * 8xxx - SUPPLIER errors
 * 9xxx - SMARTBILL errors
 * 10xxx - WOOCOMMERCE errors
 */

// General Errors (0xxx)
export const ERROR_GENERAL_INTERNAL_SERVER_ERROR: ErrorCodeDef = {
  code: 1,
  key: 'GENERAL_INTERNAL_SERVER_ERROR',
  httpStatus: 500,
  messageRo: 'Eroare internă a serverului',
  messageEn: 'Internal server error',
} as const;

export const ERROR_GENERAL_NOT_FOUND: ErrorCodeDef = {
  code: 2,
  key: 'GENERAL_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Resursa nu a fost găsită',
  messageEn: 'Resource not found',
} as const;

export const ERROR_GENERAL_UNAUTHORIZED: ErrorCodeDef = {
  code: 3,
  key: 'GENERAL_UNAUTHORIZED',
  httpStatus: 401,
  messageRo: 'Neautorizat',
  messageEn: 'Unauthorized',
} as const;

export const ERROR_GENERAL_FORBIDDEN: ErrorCodeDef = {
  code: 4,
  key: 'GENERAL_FORBIDDEN',
  httpStatus: 403,
  messageRo: 'Interzis',
  messageEn: 'Forbidden',
} as const;

export const ERROR_GENERAL_CONFLICT: ErrorCodeDef = {
  code: 5,
  key: 'GENERAL_CONFLICT',
  httpStatus: 409,
  messageRo: 'Conflict cu starea actuală',
  messageEn: 'Conflict with current state',
} as const;

export const ERROR_GENERAL_RATE_LIMIT: ErrorCodeDef = {
  code: 6,
  key: 'GENERAL_RATE_LIMIT',
  httpStatus: 429,
  messageRo: 'Prea multe cereri, încercați mai târziu',
  messageEn: 'Too many requests, try again later',
} as const;

export const ERROR_GENERAL_SERVICE_UNAVAILABLE: ErrorCodeDef = {
  code: 7,
  key: 'GENERAL_SERVICE_UNAVAILABLE',
  httpStatus: 503,
  messageRo: 'Serviciul nu este disponibil',
  messageEn: 'Service unavailable',
} as const;

export const ERROR_GENERAL_TIMEOUT: ErrorCodeDef = {
  code: 8,
  key: 'GENERAL_TIMEOUT',
  httpStatus: 504,
  messageRo: 'Timeout-ul a expirat',
  messageEn: 'Request timeout',
} as const;

// Authentication Errors (1xxx)
export const ERROR_AUTH_INVALID_CREDENTIALS: ErrorCodeDef = {
  code: 1001,
  key: 'AUTH_INVALID_CREDENTIALS',
  httpStatus: 401,
  messageRo: 'Credențiale invalide',
  messageEn: 'Invalid credentials',
} as const;

export const ERROR_AUTH_USER_NOT_FOUND: ErrorCodeDef = {
  code: 1002,
  key: 'AUTH_USER_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Utilizatorul nu a fost găsit',
  messageEn: 'User not found',
} as const;

export const ERROR_AUTH_USER_DISABLED: ErrorCodeDef = {
  code: 1003,
  key: 'AUTH_USER_DISABLED',
  httpStatus: 403,
  messageRo: 'Contul utilizatorului este dezactivat',
  messageEn: 'User account is disabled',
} as const;

export const ERROR_AUTH_SESSION_EXPIRED: ErrorCodeDef = {
  code: 1004,
  key: 'AUTH_SESSION_EXPIRED',
  httpStatus: 401,
  messageRo: 'Sesiunea a expirat',
  messageEn: 'Session expired',
} as const;

export const ERROR_AUTH_TOKEN_INVALID: ErrorCodeDef = {
  code: 1005,
  key: 'AUTH_TOKEN_INVALID',
  httpStatus: 401,
  messageRo: 'Token-ul este invalid',
  messageEn: 'Invalid token',
} as const;

export const ERROR_AUTH_INSUFFICIENT_PERMISSIONS: ErrorCodeDef = {
  code: 1006,
  key: 'AUTH_INSUFFICIENT_PERMISSIONS',
  httpStatus: 403,
  messageRo: 'Permisiuni insuficiente',
  messageEn: 'Insufficient permissions',
} as const;

export const ERROR_AUTH_ACCOUNT_LOCKED: ErrorCodeDef = {
  code: 1007,
  key: 'AUTH_ACCOUNT_LOCKED',
  httpStatus: 403,
  messageRo: 'Contul este blocat din motive de securitate',
  messageEn: 'Account is locked for security reasons',
} as const;

// Validation Errors (2xxx)
export const ERROR_VALIDATION_INVALID_INPUT: ErrorCodeDef = {
  code: 2001,
  key: 'VALIDATION_INVALID_INPUT',
  httpStatus: 400,
  messageRo: 'Date de intrare invalide',
  messageEn: 'Invalid input data',
} as const;

export const ERROR_VALIDATION_MISSING_FIELD: ErrorCodeDef = {
  code: 2002,
  key: 'VALIDATION_MISSING_FIELD',
  httpStatus: 400,
  messageRo: 'Câmp obligatoriu lipsă',
  messageEn: 'Missing required field',
} as const;

export const ERROR_VALIDATION_INVALID_EMAIL: ErrorCodeDef = {
  code: 2003,
  key: 'VALIDATION_INVALID_EMAIL',
  httpStatus: 400,
  messageRo: 'Adresă de email invalida',
  messageEn: 'Invalid email address',
} as const;

export const ERROR_VALIDATION_INVALID_PHONE: ErrorCodeDef = {
  code: 2004,
  key: 'VALIDATION_INVALID_PHONE',
  httpStatus: 400,
  messageRo: 'Numar de telefon invalid',
  messageEn: 'Invalid phone number',
} as const;

export const ERROR_VALIDATION_INVALID_FORMAT: ErrorCodeDef = {
  code: 2005,
  key: 'VALIDATION_INVALID_FORMAT',
  httpStatus: 400,
  messageRo: 'Format invalid',
  messageEn: 'Invalid format',
} as const;

export const ERROR_VALIDATION_DUPLICATE_ENTRY: ErrorCodeDef = {
  code: 2006,
  key: 'VALIDATION_DUPLICATE_ENTRY',
  httpStatus: 409,
  messageRo: 'Intrarea cu aceleași date există deja',
  messageEn: 'Duplicate entry already exists',
} as const;

export const ERROR_VALIDATION_OUT_OF_RANGE: ErrorCodeDef = {
  code: 2007,
  key: 'VALIDATION_OUT_OF_RANGE',
  httpStatus: 400,
  messageRo: 'Valoare în afara intervalului acceptat',
  messageEn: 'Value out of acceptable range',
} as const;

// Product Errors (3xxx)
export const ERROR_PRODUCT_NOT_FOUND: ErrorCodeDef = {
  code: 3001,
  key: 'PRODUCT_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Produs nu a fost găsit',
  messageEn: 'Product not found',
} as const;

export const ERROR_PRODUCT_INACTIVE: ErrorCodeDef = {
  code: 3002,
  key: 'PRODUCT_INACTIVE',
  httpStatus: 400,
  messageRo: 'Produsul este inactiv',
  messageEn: 'Product is inactive',
} as const;

export const ERROR_PRODUCT_INVALID_SKU: ErrorCodeDef = {
  code: 3003,
  key: 'PRODUCT_INVALID_SKU',
  httpStatus: 400,
  messageRo: 'SKU produs este invalid',
  messageEn: 'Invalid product SKU',
} as const;

export const ERROR_PRODUCT_INVALID_CATEGORY: ErrorCodeDef = {
  code: 3004,
  key: 'PRODUCT_INVALID_CATEGORY',
  httpStatus: 400,
  messageRo: 'Categorie de produs invalida',
  messageEn: 'Invalid product category',
} as const;

export const ERROR_PRODUCT_MISSING_PRICE: ErrorCodeDef = {
  code: 3005,
  key: 'PRODUCT_MISSING_PRICE',
  httpStatus: 400,
  messageRo: 'Preț produs lipsă',
  messageEn: 'Product price missing',
} as const;

export const ERROR_PRODUCT_SYNC_FAILED: ErrorCodeDef = {
  code: 3006,
  key: 'PRODUCT_SYNC_FAILED',
  httpStatus: 500,
  messageRo: 'Sincronizarea produsului a eșuat',
  messageEn: 'Product synchronization failed',
} as const;

// Inventory Errors (4xxx)
export const ERROR_INVENTORY_OUT_OF_STOCK: ErrorCodeDef = {
  code: 4001,
  key: 'INVENTORY_OUT_OF_STOCK',
  httpStatus: 409,
  messageRo: 'Produs epuizat din stoc',
  messageEn: 'Product out of stock',
} as const;

export const ERROR_INVENTORY_INSUFFICIENT_STOCK: ErrorCodeDef = {
  code: 4002,
  key: 'INVENTORY_INSUFFICIENT_STOCK',
  httpStatus: 409,
  messageRo: 'Stoc insuficient pentru cantitatea solicitată',
  messageEn: 'Insufficient stock for requested quantity',
} as const;

export const ERROR_INVENTORY_NEGATIVE_QUANTITY: ErrorCodeDef = {
  code: 4003,
  key: 'INVENTORY_NEGATIVE_QUANTITY',
  httpStatus: 400,
  messageRo: 'Cantitate negativă nu este permisă',
  messageEn: 'Negative quantity not allowed',
} as const;

export const ERROR_INVENTORY_UPDATE_FAILED: ErrorCodeDef = {
  code: 4004,
  key: 'INVENTORY_UPDATE_FAILED',
  httpStatus: 500,
  messageRo: 'Actualizarea inventarului a eșuat',
  messageEn: 'Inventory update failed',
} as const;

export const ERROR_INVENTORY_RESERVED_CONFLICT: ErrorCodeDef = {
  code: 4005,
  key: 'INVENTORY_RESERVED_CONFLICT',
  httpStatus: 409,
  messageRo: 'Conflict cu stocul rezervat',
  messageEn: 'Conflict with reserved inventory',
} as const;

// Order Errors (5xxx)
export const ERROR_ORDER_NOT_FOUND: ErrorCodeDef = {
  code: 5001,
  key: 'ORDER_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Comandă nu a fost găsită',
  messageEn: 'Order not found',
} as const;

export const ERROR_ORDER_INVALID_STATUS: ErrorCodeDef = {
  code: 5002,
  key: 'ORDER_INVALID_STATUS',
  httpStatus: 400,
  messageRo: 'Status de comandă invalid',
  messageEn: 'Invalid order status',
} as const;

export const ERROR_ORDER_INVALID_TRANSITION: ErrorCodeDef = {
  code: 5003,
  key: 'ORDER_INVALID_TRANSITION',
  httpStatus: 400,
  messageRo: 'Tranziție de status nevalidă',
  messageEn: 'Invalid status transition',
} as const;

export const ERROR_ORDER_EMPTY: ErrorCodeDef = {
  code: 5004,
  key: 'ORDER_EMPTY',
  httpStatus: 400,
  messageRo: 'Comandă fără articole',
  messageEn: 'Order without items',
} as const;

export const ERROR_ORDER_CUSTOMER_NOT_FOUND: ErrorCodeDef = {
  code: 5005,
  key: 'ORDER_CUSTOMER_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Clientul comenzii nu a fost găsit',
  messageEn: 'Order customer not found',
} as const;

export const ERROR_ORDER_CANNOT_CANCEL: ErrorCodeDef = {
  code: 5006,
  key: 'ORDER_CANNOT_CANCEL',
  httpStatus: 409,
  messageRo: 'Comanda nu poate fi anulată în starea actuală',
  messageEn: 'Order cannot be cancelled in current state',
} as const;

export const ERROR_ORDER_CANNOT_MODIFY: ErrorCodeDef = {
  code: 5007,
  key: 'ORDER_CANNOT_MODIFY',
  httpStatus: 409,
  messageRo: 'Comanda nu poate fi modificată în starea actuală',
  messageEn: 'Order cannot be modified in current state',
} as const;

export const ERROR_ORDER_ITEM_NOT_FOUND: ErrorCodeDef = {
  code: 5008,
  key: 'ORDER_ITEM_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Articolul comenzii nu a fost găsit',
  messageEn: 'Order item not found',
} as const;

// Quote Errors (6xxx)
export const ERROR_QUOTE_NOT_FOUND: ErrorCodeDef = {
  code: 6001,
  key: 'QUOTE_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Ofertă nu a fost găsită',
  messageEn: 'Quote not found',
} as const;

export const ERROR_QUOTE_EXPIRED: ErrorCodeDef = {
  code: 6002,
  key: 'QUOTE_EXPIRED',
  httpStatus: 410,
  messageRo: 'Oferta a expirat',
  messageEn: 'Quote has expired',
} as const;

export const ERROR_QUOTE_ALREADY_ACCEPTED: ErrorCodeDef = {
  code: 6003,
  key: 'QUOTE_ALREADY_ACCEPTED',
  httpStatus: 409,
  messageRo: 'Oferta a fost deja acceptată',
  messageEn: 'Quote already accepted',
} as const;

export const ERROR_QUOTE_INVALID_VALIDITY: ErrorCodeDef = {
  code: 6004,
  key: 'QUOTE_INVALID_VALIDITY',
  httpStatus: 400,
  messageRo: 'Perioada de valabilitate a ofertei este invalida',
  messageEn: 'Invalid quote validity period',
} as const;

export const ERROR_QUOTE_CONVERSION_FAILED: ErrorCodeDef = {
  code: 6005,
  key: 'QUOTE_CONVERSION_FAILED',
  httpStatus: 500,
  messageRo: 'Conversia ofertei în comandă a eșuat',
  messageEn: 'Quote to order conversion failed',
} as const;

// Pricing Errors (7xxx)
export const ERROR_PRICING_INVALID_AMOUNT: ErrorCodeDef = {
  code: 7001,
  key: 'PRICING_INVALID_AMOUNT',
  httpStatus: 400,
  messageRo: 'Cantitate monetară invalida',
  messageEn: 'Invalid amount',
} as const;

export const ERROR_PRICING_UNACCEPTABLE_MARGIN: ErrorCodeDef = {
  code: 7002,
  key: 'PRICING_UNACCEPTABLE_MARGIN',
  httpStatus: 400,
  messageRo: 'Marja de profit este sub minimul acceptabil',
  messageEn: 'Profit margin below acceptable minimum',
} as const;

export const ERROR_PRICING_CALCULATION_FAILED: ErrorCodeDef = {
  code: 7003,
  key: 'PRICING_CALCULATION_FAILED',
  httpStatus: 500,
  messageRo: 'Calculul prețului a eșuat',
  messageEn: 'Price calculation failed',
} as const;

export const ERROR_PRICING_COST_PRICE_MISSING: ErrorCodeDef = {
  code: 7004,
  key: 'PRICING_COST_PRICE_MISSING',
  httpStatus: 400,
  messageRo: 'Preț de cost lipsă pentru produs',
  messageEn: 'Cost price missing for product',
} as const;

export const ERROR_PRICING_INVALID_DISCOUNT: ErrorCodeDef = {
  code: 7005,
  key: 'PRICING_INVALID_DISCOUNT',
  httpStatus: 400,
  messageRo: 'Discount invalid',
  messageEn: 'Invalid discount',
} as const;

// Supplier Errors (8xxx)
export const ERROR_SUPPLIER_NOT_FOUND: ErrorCodeDef = {
  code: 8001,
  key: 'SUPPLIER_NOT_FOUND',
  httpStatus: 404,
  messageRo: 'Furnizor nu a fost găsit',
  messageEn: 'Supplier not found',
} as const;

export const ERROR_SUPPLIER_INACTIVE: ErrorCodeDef = {
  code: 8002,
  key: 'SUPPLIER_INACTIVE',
  httpStatus: 400,
  messageRo: 'Furnizor este inactiv',
  messageEn: 'Supplier is inactive',
} as const;

export const ERROR_SUPPLIER_ORDER_FAILED: ErrorCodeDef = {
  code: 8003,
  key: 'SUPPLIER_ORDER_FAILED',
  httpStatus: 500,
  messageRo: 'Plasarea comenzii la furnizor a eșuat',
  messageEn: 'Supplier order placement failed',
} as const;

export const ERROR_SUPPLIER_API_ERROR: ErrorCodeDef = {
  code: 8004,
  key: 'SUPPLIER_API_ERROR',
  httpStatus: 502,
  messageRo: 'Eroare API furnizor',
  messageEn: 'Supplier API error',
} as const;

export const ERROR_SUPPLIER_COMMUNICATION_ERROR: ErrorCodeDef = {
  code: 8005,
  key: 'SUPPLIER_COMMUNICATION_ERROR',
  httpStatus: 503,
  messageRo: 'Eroare în comunicația cu furnizorul',
  messageEn: 'Supplier communication error',
} as const;

// SmartBill Errors (9xxx)
export const ERROR_SMARTBILL_API_ERROR: ErrorCodeDef = {
  code: 9001,
  key: 'SMARTBILL_API_ERROR',
  httpStatus: 502,
  messageRo: 'Eroare API SmartBill',
  messageEn: 'SmartBill API error',
} as const;

export const ERROR_SMARTBILL_INVOICE_FAILED: ErrorCodeDef = {
  code: 9002,
  key: 'SMARTBILL_INVOICE_FAILED',
  httpStatus: 500,
  messageRo: 'Generarea facturii în SmartBill a eșuat',
  messageEn: 'Invoice generation in SmartBill failed',
} as const;

export const ERROR_SMARTBILL_AUTHENTICATION_FAILED: ErrorCodeDef = {
  code: 9003,
  key: 'SMARTBILL_AUTHENTICATION_FAILED',
  httpStatus: 401,
  messageRo: 'Autentificare SmartBill eșuată',
  messageEn: 'SmartBill authentication failed',
} as const;

export const ERROR_SMARTBILL_INVALID_CUSTOMER: ErrorCodeDef = {
  code: 9004,
  key: 'SMARTBILL_INVALID_CUSTOMER',
  httpStatus: 400,
  messageRo: 'Date client invalide pentru SmartBill',
  messageEn: 'Invalid customer data for SmartBill',
} as const;

export const ERROR_SMARTBILL_NETWORK_ERROR: ErrorCodeDef = {
  code: 9005,
  key: 'SMARTBILL_NETWORK_ERROR',
  httpStatus: 503,
  messageRo: 'Eroare de rețea SmartBill',
  messageEn: 'SmartBill network error',
} as const;

// WooCommerce Errors (10xxx)
export const ERROR_WOOCOMMERCE_API_ERROR: ErrorCodeDef = {
  code: 10001,
  key: 'WOOCOMMERCE_API_ERROR',
  httpStatus: 502,
  messageRo: 'Eroare API WooCommerce',
  messageEn: 'WooCommerce API error',
} as const;

export const ERROR_WOOCOMMERCE_SYNC_FAILED: ErrorCodeDef = {
  code: 10002,
  key: 'WOOCOMMERCE_SYNC_FAILED',
  httpStatus: 500,
  messageRo: 'Sincronizarea WooCommerce a eșuat',
  messageEn: 'WooCommerce synchronization failed',
} as const;

export const ERROR_WOOCOMMERCE_PRODUCT_SYNC_FAILED: ErrorCodeDef = {
  code: 10003,
  key: 'WOOCOMMERCE_PRODUCT_SYNC_FAILED',
  httpStatus: 500,
  messageRo: 'Sincronizarea produselor WooCommerce a eșuat',
  messageEn: 'WooCommerce product synchronization failed',
} as const;

export const ERROR_WOOCOMMERCE_ORDER_SYNC_FAILED: ErrorCodeDef = {
  code: 10004,
  key: 'WOOCOMMERCE_ORDER_SYNC_FAILED',
  httpStatus: 500,
  messageRo: 'Sincronizarea comenzilor WooCommerce a eșuat',
  messageEn: 'WooCommerce order synchronization failed',
} as const;

export const ERROR_WOOCOMMERCE_AUTHENTICATION_FAILED: ErrorCodeDef = {
  code: 10005,
  key: 'WOOCOMMERCE_AUTHENTICATION_FAILED',
  httpStatus: 401,
  messageRo: 'Autentificare WooCommerce eșuată',
  messageEn: 'WooCommerce authentication failed',
} as const;

export const ERROR_WOOCOMMERCE_NETWORK_ERROR: ErrorCodeDef = {
  code: 10006,
  key: 'WOOCOMMERCE_NETWORK_ERROR',
  httpStatus: 503,
  messageRo: 'Eroare de rețea WooCommerce',
  messageEn: 'WooCommerce network error',
} as const;

// Master error code collection
const ALL_ERROR_CODES = [
  // General
  ERROR_GENERAL_INTERNAL_SERVER_ERROR,
  ERROR_GENERAL_NOT_FOUND,
  ERROR_GENERAL_UNAUTHORIZED,
  ERROR_GENERAL_FORBIDDEN,
  ERROR_GENERAL_CONFLICT,
  ERROR_GENERAL_RATE_LIMIT,
  ERROR_GENERAL_SERVICE_UNAVAILABLE,
  ERROR_GENERAL_TIMEOUT,
  // Auth
  ERROR_AUTH_INVALID_CREDENTIALS,
  ERROR_AUTH_USER_NOT_FOUND,
  ERROR_AUTH_USER_DISABLED,
  ERROR_AUTH_SESSION_EXPIRED,
  ERROR_AUTH_TOKEN_INVALID,
  ERROR_AUTH_INSUFFICIENT_PERMISSIONS,
  ERROR_AUTH_ACCOUNT_LOCKED,
  // Validation
  ERROR_VALIDATION_INVALID_INPUT,
  ERROR_VALIDATION_MISSING_FIELD,
  ERROR_VALIDATION_INVALID_EMAIL,
  ERROR_VALIDATION_INVALID_PHONE,
  ERROR_VALIDATION_INVALID_FORMAT,
  ERROR_VALIDATION_DUPLICATE_ENTRY,
  ERROR_VALIDATION_OUT_OF_RANGE,
  // Product
  ERROR_PRODUCT_NOT_FOUND,
  ERROR_PRODUCT_INACTIVE,
  ERROR_PRODUCT_INVALID_SKU,
  ERROR_PRODUCT_INVALID_CATEGORY,
  ERROR_PRODUCT_MISSING_PRICE,
  ERROR_PRODUCT_SYNC_FAILED,
  // Inventory
  ERROR_INVENTORY_OUT_OF_STOCK,
  ERROR_INVENTORY_INSUFFICIENT_STOCK,
  ERROR_INVENTORY_NEGATIVE_QUANTITY,
  ERROR_INVENTORY_UPDATE_FAILED,
  ERROR_INVENTORY_RESERVED_CONFLICT,
  // Order
  ERROR_ORDER_NOT_FOUND,
  ERROR_ORDER_INVALID_STATUS,
  ERROR_ORDER_INVALID_TRANSITION,
  ERROR_ORDER_EMPTY,
  ERROR_ORDER_CUSTOMER_NOT_FOUND,
  ERROR_ORDER_CANNOT_CANCEL,
  ERROR_ORDER_CANNOT_MODIFY,
  ERROR_ORDER_ITEM_NOT_FOUND,
  // Quote
  ERROR_QUOTE_NOT_FOUND,
  ERROR_QUOTE_EXPIRED,
  ERROR_QUOTE_ALREADY_ACCEPTED,
  ERROR_QUOTE_INVALID_VALIDITY,
  ERROR_QUOTE_CONVERSION_FAILED,
  // Pricing
  ERROR_PRICING_INVALID_AMOUNT,
  ERROR_PRICING_UNACCEPTABLE_MARGIN,
  ERROR_PRICING_CALCULATION_FAILED,
  ERROR_PRICING_COST_PRICE_MISSING,
  ERROR_PRICING_INVALID_DISCOUNT,
  // Supplier
  ERROR_SUPPLIER_NOT_FOUND,
  ERROR_SUPPLIER_INACTIVE,
  ERROR_SUPPLIER_ORDER_FAILED,
  ERROR_SUPPLIER_API_ERROR,
  ERROR_SUPPLIER_COMMUNICATION_ERROR,
  // SmartBill
  ERROR_SMARTBILL_API_ERROR,
  ERROR_SMARTBILL_INVOICE_FAILED,
  ERROR_SMARTBILL_AUTHENTICATION_FAILED,
  ERROR_SMARTBILL_INVALID_CUSTOMER,
  ERROR_SMARTBILL_NETWORK_ERROR,
  // WooCommerce
  ERROR_WOOCOMMERCE_API_ERROR,
  ERROR_WOOCOMMERCE_SYNC_FAILED,
  ERROR_WOOCOMMERCE_PRODUCT_SYNC_FAILED,
  ERROR_WOOCOMMERCE_ORDER_SYNC_FAILED,
  ERROR_WOOCOMMERCE_AUTHENTICATION_FAILED,
  ERROR_WOOCOMMERCE_NETWORK_ERROR,
] as const;

/**
 * Get error definition by code
 * @param code Error code number
 * @returns Error definition or undefined if not found
 */
export function getErrorCodeDef(code: number): ErrorCodeDef | undefined {
  return ALL_ERROR_CODES.find((err) => err.code === code);
}

/**
 * Get error definition by key
 * @param key Error key (e.g., 'AUTH_INVALID_CREDENTIALS')
 * @returns Error definition or undefined if not found
 */
export function getErrorCodeByKey(key: string): ErrorCodeDef | undefined {
  return ALL_ERROR_CODES.find((err) => err.key === key);
}

/**
 * Get error message in specified language
 * @param code Error code number
 * @param language Language code ('ro' or 'en')
 * @returns Error message in requested language or English as fallback
 */
export function getErrorMessage(code: number, language: 'ro' | 'en' = 'en'): string {
  const errorDef = getErrorCodeDef(code);
  if (!errorDef) {
    return language === 'ro' ? 'Eroare necunoscută' : 'Unknown error';
  }

  return language === 'ro' ? errorDef.messageRo : errorDef.messageEn;
}

/**
 * Get error message by key in specified language
 * @param key Error key
 * @param language Language code ('ro' or 'en')
 * @returns Error message in requested language or English as fallback
 */
export function getErrorMessageByKey(key: string, language: 'ro' | 'en' = 'en'): string {
  const errorDef = getErrorCodeByKey(key);
  if (!errorDef) {
    return language === 'ro' ? 'Eroare necunoscută' : 'Unknown error';
  }

  return language === 'ro' ? errorDef.messageRo : errorDef.messageEn;
}

/**
 * Get HTTP status code for an error
 * @param code Error code number
 * @returns HTTP status code
 */
export function getErrorHttpStatus(code: number): number {
  const errorDef = getErrorCodeDef(code);
  return errorDef?.httpStatus || 500;
}

/**
 * Get all error codes
 * @returns Array of all error definitions
 */
export function getAllErrorCodes(): ErrorCodeDef[] {
  return [...ALL_ERROR_CODES];
}

/**
 * Get all error codes for a specific category
 * @param category Category prefix (e.g., 'AUTH', 'ORDER')
 * @returns Array of error definitions matching the category
 */
export function getErrorCodesByCategory(category: string): ErrorCodeDef[] {
  return ALL_ERROR_CODES.filter((err) => err.key.startsWith(category));
}
