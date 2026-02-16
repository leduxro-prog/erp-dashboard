import { Repository, DataSource, MoreThan, LessThan } from 'typeorm';
import { ISyncRepository, SyncStats } from '../../domain/repositories/ISyncRepository';
import { SyncItem } from '../../domain/entities/SyncItem';
import { SyncBatch } from '../../domain/entities/SyncBatch';
import { ProductSyncMapping } from '../../domain/entities/ProductSyncMapping';
import { SyncItemEntity } from '../entities/SyncItemEntity';
import { SyncBatchEntity } from '../entities/SyncBatchEntity';
import { ProductSyncMappingEntity } from '../entities/ProductSyncMappingEntity';

export class TypeOrmSyncRepository implements ISyncRepository {
  private syncItemRepo: Repository<SyncItemEntity>;
  private batchRepo: Repository<SyncBatchEntity>;
  private mappingRepo: Repository<ProductSyncMappingEntity>;

  constructor(private dataSource: DataSource) {
    this.syncItemRepo = dataSource.getRepository(SyncItemEntity);
    this.batchRepo = dataSource.getRepository(SyncBatchEntity);
    this.mappingRepo = dataSource.getRepository(ProductSyncMappingEntity);
  }

  async saveSyncItem(item: SyncItem): Promise<void> {
    const entity = this.syncItemRepo.create({
      id: item.id,
      productId: item.productId,
      wooCommerceId: item.wooCommerceId,
      syncType: item.syncType,
      status: item.status,
      payload: item.payload,
      errorMessage: item.errorMessage,
      attempts: item.attempts,
      maxAttempts: item.maxAttempts,
      lastAttempt: item.lastAttempt,
      completedAt: item.completedAt,
    });

    await this.syncItemRepo.save(entity);
  }

  async getSyncItem(id: string): Promise<SyncItem | null> {
    const entity = await this.syncItemRepo.findOne({ where: { id } });
    if (!entity) return null;

    return this.toDomainSyncItem(entity);
  }

  async getPendingItems(limit: number): Promise<SyncItem[]> {
    const entities = await this.syncItemRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return entities.map((e) => this.toDomainSyncItem(e));
  }

  async getFailedItems(): Promise<SyncItem[]> {
    const entities = await this.syncItemRepo.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
    });

    return entities.map((e) => this.toDomainSyncItem(e));
  }

  async getSyncingItems(): Promise<SyncItem[]> {
    const entities = await this.syncItemRepo.find({
      where: { status: 'syncing' },
    });

    return entities.map((e) => this.toDomainSyncItem(e));
  }

  async getItemsByProductId(productId: string): Promise<SyncItem[]> {
    const entities = await this.syncItemRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });

    return entities.map((e) => this.toDomainSyncItem(e));
  }

  /**
   * Get sync items filtered by type
   * @param syncType - Type of sync operation (e.g., 'product', 'stock')
   * @returns Array of matching sync items
   */
  async getItemsByType(syncType: string): Promise<SyncItem[]> {
    const entities = await this.syncItemRepo.find({
      where: { syncType: syncType as any },
      order: { createdAt: 'DESC' },
    });

    return entities.map((e) => this.toDomainSyncItem(e));
  }

  async deleteSyncItem(id: string): Promise<void> {
    await this.syncItemRepo.delete({ id });
  }

  async updateSyncItem(item: SyncItem): Promise<void> {
    const entity = await this.syncItemRepo.findOne({ where: { id: item.id } });
    if (!entity) throw new Error(`SyncItem not found: ${item.id}`);

    entity.status = item.status;
    entity.errorMessage = item.errorMessage;
    entity.attempts = item.attempts;
    entity.lastAttempt = item.lastAttempt;
    entity.completedAt = item.completedAt;

    await this.syncItemRepo.save(entity);
  }

  async saveBatch(batch: SyncBatch): Promise<void> {
    const entity = this.batchRepo.create({
      id: batch.id,
      status: batch.status,
      batchSize: batch.batchSize,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      totalItems: batch.totalItems,
      successCount: batch.successCount,
      failCount: batch.failCount,
    });

    await this.batchRepo.save(entity);
  }

  async getBatch(id: string): Promise<SyncBatch | null> {
    const entity = await this.batchRepo.findOne({ where: { id } });
    if (!entity) return null;

    return this.toDomainBatch(entity);
  }

  async updateBatch(batch: SyncBatch): Promise<void> {
    const entity = await this.batchRepo.findOne({ where: { id: batch.id } });
    if (!entity) throw new Error(`Batch not found: ${batch.id}`);

    entity.status = batch.status;
    entity.startedAt = batch.startedAt;
    entity.completedAt = batch.completedAt;
    entity.totalItems = batch.totalItems;
    entity.successCount = batch.successCount;
    entity.failCount = batch.failCount;

    await this.batchRepo.save(entity);
  }

  async getRecentBatches(limit: number): Promise<SyncBatch[]> {
    const entities = await this.batchRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return entities.map((e) => this.toDomainBatch(e));
  }

  async getMapping(internalProductId: string): Promise<ProductSyncMapping | null> {
    const entity = await this.mappingRepo.findOne({
      where: { internalProductId },
    });

    if (!entity) return null;

    return this.toDomainMapping(entity);
  }

  async getMappingByWooId(wooCommerceProductId: number): Promise<ProductSyncMapping | null> {
    const entity = await this.mappingRepo.findOne({
      where: { wooCommerceProductId },
    });

    if (!entity) return null;

    return this.toDomainMapping(entity);
  }

  async createMapping(mapping: ProductSyncMapping): Promise<void> {
    const entity = this.mappingRepo.create({
      id: mapping.id,
      internalProductId: mapping.internalProductId,
      wooCommerceProductId: mapping.wooCommerceProductId,
      lastSynced: mapping.lastSynced,
      syncStatus: mapping.syncStatus,
      errorMessage: mapping.errorMessage,
    });

    await this.mappingRepo.save(entity);
  }

  async updateMapping(mapping: ProductSyncMapping): Promise<void> {
    const entity = await this.mappingRepo.findOne({
      where: { id: mapping.id },
    });

    if (!entity) throw new Error(`Mapping not found: ${mapping.id}`);

    entity.lastSynced = mapping.lastSynced;
    entity.syncStatus = mapping.syncStatus;
    entity.errorMessage = mapping.errorMessage;

    await this.mappingRepo.save(entity);
  }

  async deleteMapping(internalProductId: string): Promise<void> {
    await this.mappingRepo.delete({ internalProductId });
  }

  async getAllMappings(): Promise<ProductSyncMapping[]> {
    const entities = await this.mappingRepo.find();
    return entities.map((e) => this.toDomainMapping(e));
  }

  /**
   * Get product sync mappings filtered by status
   * @param status - Sync status ('in_sync', 'out_of_sync', 'error')
   * @returns Array of matching product sync mappings
   */
  async getMappingsByStatus(status: string): Promise<ProductSyncMapping[]> {
    const entities = await this.mappingRepo.find({
      where: { syncStatus: status as any },
    });

    return entities.map((e) => this.toDomainMapping(e));
  }

  async getSyncStats(): Promise<SyncStats> {
    const [totalSyncItems, pendingCount, syncingCount, completedCount, failedCount, totalMappings, inSyncCount, outOfSyncCount, errorCount] = await Promise.all([
      this.syncItemRepo.count(),
      this.syncItemRepo.count({ where: { status: 'pending' } }),
      this.syncItemRepo.count({ where: { status: 'syncing' } }),
      this.syncItemRepo.count({ where: { status: 'completed' } }),
      this.syncItemRepo.count({ where: { status: 'failed' } }),
      this.mappingRepo.count(),
      this.mappingRepo.count({ where: { syncStatus: 'in_sync' } }),
      this.mappingRepo.count({ where: { syncStatus: 'out_of_sync' } }),
      this.mappingRepo.count({ where: { syncStatus: 'error' } }),
    ]);

    return {
      totalSyncItems,
      pendingCount,
      syncingCount,
      completedCount,
      failedCount,
      totalMappings,
      inSyncCount,
      outOfSyncCount,
      errorCount,
    };
  }

  async deleteOldSyncItems(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.syncItemRepo.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }

  async deleteOldBatches(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.batchRepo.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }

  private toDomainSyncItem(entity: SyncItemEntity): SyncItem {
    const item = new SyncItem(
      entity.id,
      entity.productId,
      entity.syncType,
      entity.payload,
      entity.maxAttempts
    );
    item.wooCommerceId = entity.wooCommerceId;
    item.status = entity.status;
    item.attempts = entity.attempts;
    item.errorMessage = entity.errorMessage;
    item.lastAttempt = entity.lastAttempt;
    item.completedAt = entity.completedAt;
    return item;
  }

  private toDomainBatch(entity: SyncBatchEntity): SyncBatch {
    const batch = new SyncBatch(entity.id, entity.batchSize);
    batch.status = entity.status;
    batch.startedAt = entity.startedAt;
    batch.completedAt = entity.completedAt;
    batch.totalItems = entity.totalItems;
    batch.successCount = entity.successCount;
    batch.failCount = entity.failCount;
    return batch;
  }

  private toDomainMapping(entity: ProductSyncMappingEntity): ProductSyncMapping {
    const mapping = new ProductSyncMapping(
      entity.id,
      entity.internalProductId,
      entity.wooCommerceProductId
    );
    mapping.lastSynced = entity.lastSynced;
    mapping.syncStatus = entity.syncStatus;
    mapping.errorMessage = entity.errorMessage;
    return mapping;
  }
}
