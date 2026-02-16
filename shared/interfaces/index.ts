/**
 * CYPHER ERP - Shared Interface Definitions
 *
 * These interfaces define the contracts between different modules:
 * - Agent A creates these interfaces and implements them
 * - Agent B consumes these interfaces and integrates with Agent A
 *
 * All interfaces represent async operations using Promise types.
 */

// Pricing Service
export {
  IPricingService,
  TierPricingInfo,
  OrderPriceCalculation,
} from './pricing.interface';

// Inventory Service
export {
  IInventoryService,
  ReserveStockItem,
  ReservationResult,
  SyncResult,
} from './inventory.interface';

// Order Service
export {
  IOrderService,
  PartialDeliveryItem,
  Invoice,
  ProformaInvoice,
} from './order.interface';

// Quotation Service
export {
  IQuotationService,
  QuoteFilters,
} from './quotation.interface';

// Supplier Service
export {
  ISupplierService,
  ScrapeResult,
  SupplierSkuMapping,
  SupplierProduct,
  SupplierOrderItem,
  SupplierOrderResult,
} from './supplier.interface';

// Notification Service (Agent B implements)
export {
  INotificationService,
  EmailAttachment,
  InternalAlert,
  NotificationPayload,
} from './notification.interface';

// SmartBill Service
export {
  ISmartBillService,
  SmartBillSyncResult,
  SmartBillInvoiceResult,
  SmartBillProformaResult,
  SmartBillWarehouse,
  SmartBillProduct,
} from './smartbill.interface';

// WooCommerce Service
export {
  IWooCommerceService,
  WooSyncResult,
  WooPulledOrder,
} from './woocommerce.interface';

// Event Publisher
export { IEventPublisher } from './event-publisher.interface';

// Audit Logger
export {
  IAuditLogger,
  AuditEvent,
  AuditChanges,
} from './audit-logger.interface';
