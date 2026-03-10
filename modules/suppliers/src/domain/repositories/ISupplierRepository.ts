import { Supplier } from '../entities/Supplier';
import { SupplierProduct } from '../entities/SupplierProduct';
import { SkuMapping } from '../entities/SkuMapping';
import { SupplierOrder } from '../entities/SupplierOrder';
import { SupplierProductSpecification } from '../entities/SupplierProductSpecification';

export interface BulkUpsertResult {
  updated: number;
  created: number;
}

export interface SupplierPricingRule {
  supplierCode: string;
  categoryKey: string;
  markupPercent: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSupplierPricingRuleInput {
  supplierCode: string;
  categoryKey: string;
  markupPercent: number;
  active?: boolean;
}

export interface ISupplierRepository {
  // Supplier operations
  getSupplier(id: number): Promise<Supplier | null>;
  getSupplierByCode(code: string): Promise<Supplier | null>;
  listSuppliers(activeOnly?: boolean): Promise<Supplier[]>;

  // Supplier Product operations
  getSupplierProducts(supplierId: number): Promise<SupplierProduct[]>;
  getSupplierProduct(
    supplierId: number,
    supplierSku: string,
  ): Promise<SupplierProduct | null>;
  upsertSupplierProduct(product: SupplierProduct): Promise<void>;
  bulkUpsertProducts(
    products: SupplierProduct[],
  ): Promise<BulkUpsertResult>;
  upsertProductSpecifications(
    specifications: SupplierProductSpecification[],
    options?: {
      conflictPolicy?: 'overwrite' | 'merge_non_empty';
      source?: string;
    },
  ): Promise<number>;

  // SKU Mapping operations
  getSkuMapping(
    supplierId: number,
    supplierSku: string,
  ): Promise<SkuMapping | null>;
  getSkuMappings(supplierId: number): Promise<SkuMapping[]>;
  createSkuMapping(mapping: SkuMapping): Promise<SkuMapping>;
  updateSkuMapping(mapping: SkuMapping): Promise<void>;
  deleteSkuMapping(id: number): Promise<void>;

  // Supplier Order operations
  createSupplierOrder(order: SupplierOrder): Promise<SupplierOrder>;
  getSupplierOrder(id: number): Promise<SupplierOrder | null>;
  getSupplierOrders(
    supplierId: number,
    limit?: number,
    offset?: number,
  ): Promise<SupplierOrder[]>;
  updateSupplierOrder(order: SupplierOrder): Promise<void>;

  // Sync tracking
  updateLastSync(supplierId: number, syncTime: Date): Promise<void>;
  getLastSync(supplierId: number): Promise<Date | null>;

  // Supplier Pricing Rule operations
  listSupplierPricingRules(supplierCode: string): Promise<SupplierPricingRule[]>;
  getSupplierPricingRule(
    supplierCode: string,
    categoryKey: string,
  ): Promise<SupplierPricingRule | null>;
  upsertSupplierPricingRule(
    input: UpsertSupplierPricingRuleInput,
  ): Promise<SupplierPricingRule>;
  updateSupplierPricingRuleActive(
    supplierCode: string,
    categoryKey: string,
    active: boolean,
  ): Promise<SupplierPricingRule | null>;
}
