// Entities
export { Supplier, SupplierEntity, SupplierCode, KNOWN_SUPPLIERS, type SupplierCredentials } from './entities/Supplier';
export {
  SupplierProduct,
  SupplierProductEntity,
  type PriceHistoryEntry,
} from './entities/SupplierProduct';
export { SkuMapping, SkuMappingEntity } from './entities/SkuMapping';
export {
  SupplierOrder,
  SupplierOrderEntity,
  SupplierOrderStatus,
  type SupplierOrderItem,
} from './entities/SupplierOrder';

// Services
export { SkuMappingService } from './services/SkuMappingService';

// Repositories
export { ISupplierRepository, type BulkUpsertResult } from './repositories/ISupplierRepository';
