// Default export: runtime instance for module auto-discovery
import { PurchasingModule } from './purchasing-module';
export * from './infrastructure/repositories/InMemoryRepositories';
export * from './infrastructure/repositories/TypeOrmRequisitionRepository';
export * from './infrastructure/repositories/TypeOrmPurchaseOrderRepository';
export * from './infrastructure/repositories/TypeOrmGRNRepository';
export * from './infrastructure/repositories/TypeOrmInvoiceRepository';
export * from './infrastructure/repositories/TypeOrmMatchRepository';
export { PurchasingModule };
const purchasingModule = new PurchasingModule();
export default purchasingModule;
