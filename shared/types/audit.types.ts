/**
 * Audit logging and system settings types
 */

import { BaseEntity } from './common.types';

/**
 * Audit log entry for tracking changes
 */
export interface AuditLog extends BaseEntity {
  /** User ID who performed action */
  userId: number;
  /** User email (for reference) */
  userEmail: string;
  /** Entity type being audited (user, customer, product, order, etc.) */
  entityType: string;
  /** Entity ID being audited */
  entityId: number;
  /** Action performed (CREATE, READ, UPDATE, DELETE, etc.) */
  action: string;
  /** Changes made (old values vs new values) */
  changes?: Record<string, { oldValue: unknown; newValue: unknown }> | null;
  /** Full entity state after action */
  entityState?: Record<string, unknown> | null;
  /** IP address of user */
  ipAddress: string;
  /** User agent/browser info */
  userAgent?: string | null;
  /** Timestamp of action */
  actionTimestamp: Date;
  /** Resource/path accessed */
  resourcePath?: string | null;
  /** HTTP method (GET, POST, PUT, DELETE, PATCH) */
  httpMethod?: string | null;
  /** HTTP status code */
  httpStatusCode?: number | null;
  /** Response time in milliseconds */
  responseTimeMs?: number | null;
  /** Whether action was successful */
  wasSuccessful: boolean;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Additional context/metadata */
  metadata?: Record<string, unknown> | null;
  /** Sensitive data flag (redacted in logs) */
  containsSensitiveData: boolean;
}

/**
 * System settings and configuration
 */
export interface Setting extends BaseEntity {
  /** Setting key/identifier */
  key: string;
  /** Setting value */
  value: string;
  /** Setting type (string, number, boolean, json) */
  type: 'string' | 'number' | 'boolean' | 'json';
  /** Setting description */
  description?: string | null;
  /** Setting category (system, business, integration, etc.) */
  category: string;
  /** Whether setting is editable */
  isEditable: boolean;
  /** Whether setting requires system restart */
  requiresRestart: boolean;
  /** Default value */
  defaultValue?: string | null;
  /** Possible values (for enum-like settings) */
  possibleValues?: string[] | null;
  /** Last modified by user ID */
  modifiedByUserId?: number | null;
  /** Last modified timestamp */
  modifiedAt?: Date | null;
  /** Environment (development, staging, production) */
  environment?: string | null;
}

/**
 * Business settings category
 */
export const BusinessSettingsKeys = {
  /** Company name */
  COMPANY_NAME: 'company_name',
  /** Company email */
  COMPANY_EMAIL: 'company_email',
  /** Company phone */
  COMPANY_PHONE: 'company_phone',
  /** Company website */
  COMPANY_WEBSITE: 'company_website',
  /** Company logo URL */
  COMPANY_LOGO: 'company_logo',
  /** Company address */
  COMPANY_ADDRESS: 'company_address',
  /** Company city */
  COMPANY_CITY: 'company_city',
  /** Company zip code */
  COMPANY_ZIPCODE: 'company_zipcode',
  /** Company country */
  COMPANY_COUNTRY: 'company_country',
  /** VAT number */
  VAT_NUMBER: 'vat_number',
  /** Registration number */
  REGISTRATION_NUMBER: 'registration_number',
  /** Bank IBAN */
  BANK_IBAN: 'bank_iban',
  /** Default currency (RON) */
  DEFAULT_CURRENCY: 'default_currency',
  /** VAT rate (19%) */
  VAT_RATE: 'vat_rate',
  /** Default payment terms (days) */
  DEFAULT_PAYMENT_TERMS_DAYS: 'default_payment_terms_days',
  /** Default quote validity (days) */
  DEFAULT_QUOTE_VALIDITY_DAYS: 'default_quote_validity_days',
} as const;

/**
 * System settings category
 */
export const SystemSettingsKeys = {
  /** Whether B2B registration is enabled */
  B2B_REGISTRATION_ENABLED: 'b2b_registration_enabled',
  /** Whether B2B registration requires approval */
  B2B_REGISTRATION_REQUIRES_APPROVAL: 'b2b_registration_requires_approval',
  /** B2B registration approval token validity (days) */
  B2B_REGISTRATION_VALIDITY_DAYS: 'b2b_registration_validity_days',
  /** Enable guest checkout */
  ENABLE_GUEST_CHECKOUT: 'enable_guest_checkout',
  /** Require account for orders */
  REQUIRE_ACCOUNT_FOR_ORDERS: 'require_account_for_orders',
  /** Enable two-factor authentication */
  ENABLE_2FA: 'enable_2fa',
  /** Require two-factor authentication */
  REQUIRE_2FA: 'require_2fa',
  /** Password minimum length */
  PASSWORD_MIN_LENGTH: 'password_min_length',
  /** Password expiry days (0 = never) */
  PASSWORD_EXPIRY_DAYS: 'password_expiry_days',
  /** Session timeout minutes */
  SESSION_TIMEOUT_MINUTES: 'session_timeout_minutes',
  /** Max login attempts before lockout */
  MAX_LOGIN_ATTEMPTS: 'max_login_attempts',
  /** Lockout duration minutes */
  LOCKOUT_DURATION_MINUTES: 'lockout_duration_minutes',
  /** Enable email verification */
  ENABLE_EMAIL_VERIFICATION: 'enable_email_verification',
  /** Enable order notifications */
  ENABLE_ORDER_NOTIFICATIONS: 'enable_order_notifications',
  /** Enable WhatsApp notifications */
  ENABLE_WHATSAPP_NOTIFICATIONS: 'enable_whatsapp_notifications',
  /** Enable SMS notifications */
  ENABLE_SMS_NOTIFICATIONS: 'enable_sms_notifications',
  /** Default notification language */
  DEFAULT_NOTIFICATION_LANGUAGE: 'default_notification_language',
} as const;

/**
 * Integration settings category
 */
export const IntegrationSettingsKeys = {
  /** Enable SmartBill integration */
  SMARTBILL_ENABLED: 'smartbill_enabled',
  /** SmartBill auto-sync interval (minutes) */
  SMARTBILL_AUTO_SYNC_INTERVAL: 'smartbill_auto_sync_interval',
  /** SmartBill auto-create invoices */
  SMARTBILL_AUTO_CREATE_INVOICES: 'smartbill_auto_create_invoices',
  /** Enable WooCommerce integration */
  WOOCOMMERCE_ENABLED: 'woocommerce_enabled',
  /** WooCommerce auto-sync interval (minutes) */
  WOOCOMMERCE_AUTO_SYNC_INTERVAL: 'woocommerce_auto_sync_interval',
  /** WooCommerce auto-sync prices */
  WOOCOMMERCE_AUTO_SYNC_PRICES: 'woocommerce_auto_sync_prices',
  /** WooCommerce auto-sync stock */
  WOOCOMMERCE_AUTO_SYNC_STOCK: 'woocommerce_auto_sync_stock',
} as const;

/**
 * Email settings category
 */
export const EmailSettingsKeys = {
  /** SMTP host */
  SMTP_HOST: 'smtp_host',
  /** SMTP port */
  SMTP_PORT: 'smtp_port',
  /** SMTP username */
  SMTP_USERNAME: 'smtp_username',
  /** SMTP password (encrypted) */
  SMTP_PASSWORD: 'smtp_password',
  /** SMTP from address */
  SMTP_FROM_ADDRESS: 'smtp_from_address',
  /** SMTP from name */
  SMTP_FROM_NAME: 'smtp_from_name',
  /** Use TLS */
  SMTP_USE_TLS: 'smtp_use_tls',
  /** Email provider (internal, sendgrid, etc.) */
  EMAIL_PROVIDER: 'email_provider',
} as const;

/**
 * Inventory settings category
 */
export const InventorySettingsKeys = {
  /** Low stock warning level (percentage) */
  LOW_STOCK_WARNING_LEVEL: 'low_stock_warning_level',
  /** Low stock notification recipients (emails) */
  LOW_STOCK_NOTIFICATION_RECIPIENTS: 'low_stock_notification_recipients',
  /** Enable stock reservations */
  ENABLE_STOCK_RESERVATIONS: 'enable_stock_reservations',
  /** Stock reservation expiry (hours) */
  STOCK_RESERVATION_EXPIRY_HOURS: 'stock_reservation_expiry_hours',
  /** Enable backorder */
  ENABLE_BACKORDER: 'enable_backorder',
  /** Allow negative stock */
  ALLOW_NEGATIVE_STOCK: 'allow_negative_stock',
  /** Default reorder point */
  DEFAULT_REORDER_POINT: 'default_reorder_point',
  /** Default reorder quantity */
  DEFAULT_REORDER_QUANTITY: 'default_reorder_quantity',
} as const;

/**
 * Shipping settings category
 */
export const ShippingSettingsKeys = {
  /** Enable free shipping */
  ENABLE_FREE_SHIPPING: 'enable_free_shipping',
  /** Free shipping minimum amount */
  FREE_SHIPPING_MINIMUM_AMOUNT: 'free_shipping_minimum_amount',
  /** Default shipping cost */
  DEFAULT_SHIPPING_COST: 'default_shipping_cost',
  /** Default shipping provider */
  DEFAULT_SHIPPING_PROVIDER: 'default_shipping_provider',
  /** Enable international shipping */
  ENABLE_INTERNATIONAL_SHIPPING: 'enable_international_shipping',
  /** Default delivery days */
  DEFAULT_DELIVERY_DAYS: 'default_delivery_days',
} as const;

/**
 * DTO for updating setting
 */
export interface UpdateSettingDTO {
  key: string;
  value: string;
  category?: string;
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  entityType?: string;
  entityId?: number;
  userId?: number;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  wasSuccessful?: boolean;
  containsSensitiveData?: boolean;
  search?: string;
}

/**
 * System health check result
 */
export interface SystemHealthCheck {
  /** Overall status */
  status: 'healthy' | 'warning' | 'critical';
  /** Checks performed */
  checks: {
    database: { status: 'ok' | 'error'; message?: string };
    cache: { status: 'ok' | 'error'; message?: string };
    storage: { status: 'ok' | 'error'; message?: string };
    smartbill: { status: 'ok' | 'error' | 'not_configured'; message?: string };
    woocommerce: { status: 'ok' | 'error' | 'not_configured'; message?: string };
    email: { status: 'ok' | 'error' | 'not_configured'; message?: string };
  };
  /** Timestamp of check */
  checkedAt: Date;
}

/**
 * Activity log for user actions
 */
export interface ActivityLog extends BaseEntity {
  /** User ID */
  userId: number;
  /** Activity type */
  activityType: string;
  /** Activity description */
  description: string;
  /** Related entity type */
  relatedEntityType?: string | null;
  /** Related entity ID */
  relatedEntityId?: number | null;
  /** IP address */
  ipAddress: string;
  /** Device information */
  deviceInfo?: Record<string, unknown> | null;
  /** Metadata */
  metadata?: Record<string, unknown> | null;
}
