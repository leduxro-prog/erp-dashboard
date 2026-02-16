// Use Cases
export { SyncProduct } from './use-cases/SyncProduct';
export { SyncAllProducts } from './use-cases/SyncAllProducts';
export { SyncStock } from './use-cases/SyncStock';
export { SyncPrice } from './use-cases/SyncPrice';
export { SyncCategories } from './use-cases/SyncCategories';
export { PullOrders } from './use-cases/PullOrders';
export { HandleSyncEvent, type SyncEvent } from './use-cases/HandleSyncEvent';

// DTOs
export {
  type SyncResult,
  type BatchSyncResult,
  type PulledOrder,
  type PulledOrderItem,
  type ShippingAddress,
  type BillingAddress,
  type WooCommerceProduct,
  type CreateProductPayload,
  type UpdateProductPayload,
  // Note: SyncStats is exported from domain/repositories/ISyncRepository
} from './dtos/woocommerce.dtos';

// Errors
export {
  WooCommerceError,
  WooCommerceApiError,
  SyncError,
  MappingNotFoundError,
  NetworkError,
  RateLimitError,
  ValidationError,
} from './errors/woocommerce.errors';
