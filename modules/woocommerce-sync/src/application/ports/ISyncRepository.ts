/**
 * WooCommerce Sync Repository Port (Application Layer)
 * Defines the contract for WooCommerce sync data persistence
 */

import { SyncItem } from '../../domain/entities/SyncItem';
import { SyncBatch } from '../../domain/entities/SyncBatch';
import { ProductSyncMapping } from '../../domain/entities/ProductSyncMapping';

export interface SyncStats {
  totalSyncItems: number;
  pendingCount: number;
  syncingCount: number;
  completedCount: number;
  failedCount: number;
  totalMappings: number;
  inSyncCount: number;
  outOfSyncCount: number;
  errorCount: number;
}

/**
 * Port interface for WooCommerce sync data access
 * Abstracts the data persistence layer from business logic
 */
export interface ISyncRepository {
  // SyncItem operations
  saveSyncItem(item: SyncItem): Promise<void>;
  getSyncItem(id: string): Promise<SyncItem | null>;
  getPendingItems(limit: number): Promise<SyncItem[]>;
  getFailedItems(): Promise<SyncItem[]>;
  getSyncingItems(): Promise<SyncItem[]>;
  getItemsByProductId(productId: string): Promise<SyncItem[]>;
  getItemsByType(syncType: string): Promise<SyncItem[]>;
  deleteSyncItem(id: string): Promise<void>;
  updateSyncItem(item: SyncItem): Promise<void>;

  // SyncBatch operations
  saveBatch(batch: SyncBatch): Promise<void>;
  getBatch(id: string): Promise<SyncBatch | null>;
  updateBatch(batch: SyncBatch): Promise<void>;
  getRecentBatches(limit: number): Promise<SyncBatch[]>;

  // ProductSyncMapping operations
  getMapping(internalProductId: string): Promise<ProductSyncMapping | null>;
  getMappingByWooId(wooCommerceProductId: number): Promise<ProductSyncMapping | null>;
  createMapping(mapping: ProductSyncMapping): Promise<void>;
  updateMapping(mapping: ProductSyncMapping): Promise<void>;
  deleteMapping(internalProductId: string): Promise<void>;
  getAllMappings(): Promise<ProductSyncMapping[]>;
  getMappingsByStatus(status: string): Promise<ProductSyncMapping[]>;

  // Statistics
  getSyncStats(): Promise<SyncStats>;

  // Cleanup
  deleteOldSyncItems(olderThanDays: number): Promise<number>;
  deleteOldBatches(olderThanDays: number): Promise<number>;
}
