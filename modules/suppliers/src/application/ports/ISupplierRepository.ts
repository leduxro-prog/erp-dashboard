/**
 * Supplier Repository Port (Application Layer)
 * Defines the contract for Supplier data persistence
 */

import { Supplier } from '../../domain/entities/Supplier';
import {
  SupplierProduct,
  SupplierProductSpecification,
} from '../../domain/entities/SupplierProduct';
import { SkuMapping } from '../../domain/entities/SkuMapping';
import { SupplierOrder } from '../../domain/entities/SupplierOrder';

export interface BulkUpsertResult {
  updated: number;
  created: number;
}

export interface CategoryMarkup {
  id: number;
  supplierId: number;
  categoryId: number;
  categoryName: string;
  markupPercentage: number;
  isActive: boolean;
}

export interface ManufacturerMarkup {
  id: number;
  supplierId: number;
  manufacturerId: number;
  manufacturerName: string;
  markupPercentage: number;
  isActive: boolean;
}

export interface SupplierSyncReport {
  syncStatus?: string;
  errorMessage?: string | null;
  createdAt?: Date | string;
}

/**
 * Port interface for Supplier data access
 * Abstracts the data persistence layer from business logic
 */
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

  // Specifications and sync reporting
  upsertProductSpecifications(
    specs: SupplierProductSpecification[],
    options?: { conflictPolicy?: string; source?: string },
  ): Promise<number>;
  getSyncReports(supplierId: number, limit?: number): Promise<SupplierSyncReport[]>;
}
