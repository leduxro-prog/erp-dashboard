/**
 * Central export file for all CYPHER ERP type definitions
 *
 * This file re-exports all types from individual domain modules
 * to provide a single import point for the entire application.
 */

// Common types
export {
  BaseEntity,
  LanguageEnum,
  Language,
  CurrencyEnum,
  Currency,
  SortOrderEnum,
  SortOrder,
  PaginationRequest,
  PaginationResponse,
  PaginatedResult,
  ErrorResponse,
  ApiResponse,
  VAT_RATE,
  PAGINATION_LIMITS,
} from './common.types';

// User types
export {
  UserRoleEnum,
  UserRole,
  GenderEnum,
  Gender,
  User,
  UserDevice,
  User2FA,
  PasswordResetToken,
  CreateUserDTO,
  UpdateUserDTO,
  LoginRequest,
  ChangePasswordRequest,
  UserSession,
} from './user.types';

// Customer types
export {
  CustomerTypeEnum,
  CustomerType,
  CustomerStatusEnum,
  CustomerStatus,
  B2BRegistrationStatusEnum,
  B2BRegistrationStatus,
  CustomerTier,
  CreditLimit,
  Customer,
  B2BRegistration,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CreateB2BRegistrationDTO,
} from './customer.types';

// Product types
export {
  Category,
  CategoryTranslation,
  Product,
  ProductTranslation,
  ProductImage,
  ProductAttribute,
  ProductVariant,
  ProductRelation,
  ProductReview,
  CreateProductDTO,
  UpdateProductDTO,
  ProductFilters,
  ProductWithDetails,
} from './product.types';

// Inventory types
export {
  StockMovementTypeEnum,
  StockMovementType,
  StockSourceEnum,
  StockSource,
  Warehouse,
  StockLevel,
  StockMovement,
  StockSyncLog,
  LowStockAlert,
  StockInfo,
  CreateStockMovementDTO,
  UpdateStockLevelDTO,
  InventoryCountRequest,
  InventoryCountItem,
} from './inventory.types';

// Supplier types
export {
  Supplier,
  SupplierProduct,
  SupplierSkuMapping,
  SupplierPurchaseOrder,
  SupplierPurchaseOrderItem,
  SupplierSyncLog,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  CreateSupplierSkuMappingDTO,
  CreateSupplierPurchaseOrderDTO,
} from './supplier.types';

// Order types
export {
  OrderStatusEnum,
  OrderStatus,
  PaymentStatusEnum,
  PaymentStatus,
  Order,
  OrderItem,
  OrderStatusHistory,
  ProformaInvoice,
  OrderPayment,
  OrderReturn,
  CreateOrderDTO,
  UpdateOrderDTO,
  OrderFilters,
  OrderSummary,
  OrderShipping,
} from './order.types';

// Quote types
export {
  QuoteStatusEnum,
  QuoteStatus,
  Quote,
  QuoteItem,
  QuoteTemplate,
  QuoteComparison,
  QuoteHistory,
  CreateQuoteDTO,
  UpdateQuoteDTO,
  QuoteActionDTO,
  QuoteFilters,
  QuoteSummary,
} from './quote.types';

// Pricing types
export {
  PriceRule,
  VolumeDiscount,
  PromotionalPrice,
  CustomerPrice,
  PriceResult,
  DiscountResult,
  CartItem,
  CartSummary,
  PromotionalCode,
  CalculatePriceDTO,
  CreatePriceRuleDTO,
  CreateVolumeDiscountDTO,
} from './pricing.types';

// Configurator types
export {
  ConfiguratorTypeEnum,
  ConfiguratorType,
  CompatibilityRuleTypeEnum,
  CompatibilityRuleType,
  ConfiguratorSession,
  TrackConfiguration,
  TrackConfigItem,
  LEDStripConfiguration,
  LEDConfigItem,
  CompatibilityRule,
  ConfiguratorComponent,
  CreateConfiguratorSessionDTO,
  UpdateTrackConfigurationDTO,
  UpdateLEDStripConfigurationDTO,
  ConfigurationValidationResult,
  ConvertToQuoteDTO,
} from './configurator.types';

// Integration types
export {
  SmartBillSyncTypeEnum,
  SmartBillSyncType,
  WooCommerceSyncTypeEnum,
  WooCommerceSyncType,
  SmartBillSync,
  WooCommerceSync,
  SmartBillConfig,
  WooCommerceConfig,
  SmartBillInvoiceSync,
  WooCommerceProductMap,
  WooCommerceCategoryMap,
  WebhookEvent,
  ConfigureSmartBillDTO,
  ConfigureWooCommerceDTO,
  SyncStatusSummary,
  ManualSyncRequest,
} from './integration.types';

// Notification types
export {
  WhatsAppDirectionEnum,
  WhatsAppDirection,
  WhatsAppMessageTypeEnum,
  WhatsAppMessageType,
  NotificationTypeEnum,
  NotificationType,
  WhatsAppMessage,
  SMSMessage,
  EmailMessage,
  InAppNotification,
  Notification,
  NotificationTemplate,
  NotificationPayload,
  NotificationPreference,
  NotificationQueue,
  SendNotificationDTO,
  UpdateNotificationPreferencesDTO,
} from './notification.types';

// Audit types
export {
  AuditLog,
  Setting,
  BusinessSettingsKeys,
  SystemSettingsKeys,
  IntegrationSettingsKeys,
  EmailSettingsKeys,
  InventorySettingsKeys,
  ShippingSettingsKeys,
  UpdateSettingDTO,
  AuditLogFilters,
  SystemHealthCheck,
  ActivityLog,
} from './audit.types';
