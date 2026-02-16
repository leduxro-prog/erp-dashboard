import { DataSource, In, Repository } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';
import { StockItemEntity } from '../entities/StockItemEntity';
import { StockMovementEntity, StockMovementType, ReferenceType } from '../entities/StockMovementEntity';
import { LowStockAlertEntity, AlertSeverity } from '../entities/LowStockAlertEntity';
import { StockReservationEntity, ReservationStatus } from '../entities/StockReservationEntity';
import { WarehouseEntity } from '../entities/WarehouseEntity';
import { StockCache } from '../cache/StockCache';
import {
  IInventoryRepository,
  StockLevel,
  StockMovement,
  LowStockAlert,
  StockReservation,
  Warehouse,
} from '../../domain/ports/IInventoryRepository';
import { v4 as uuidv4 } from 'uuid';

export class TypeOrmInventoryRepository implements IInventoryRepository {
  private stockItemRepo: Repository<StockItemEntity>;
  private movementRepo: Repository<StockMovementEntity>;
  private alertRepo: Repository<LowStockAlertEntity>;
  private reservationRepo: Repository<StockReservationEntity>;
  private warehouseRepo: Repository<WarehouseEntity>;
  private logger = createModuleLogger('inventory');

  constructor(
    private dataSource: DataSource,
    private cache: StockCache,
  ) {
    this.stockItemRepo = dataSource.getRepository(StockItemEntity);
    this.movementRepo = dataSource.getRepository(StockMovementEntity);
    this.alertRepo = dataSource.getRepository(LowStockAlertEntity);
    this.reservationRepo = dataSource.getRepository(StockReservationEntity);
    this.warehouseRepo = dataSource.getRepository(WarehouseEntity);
  }

  async getStockLevel(productId: string, warehouseId?: string): Promise<StockLevel[]> {
    const cached = await this.cache.getStock(productId);
    if (cached) {
      // If we have warehouseId filter, filter the cached result
      if (warehouseId) {
        return cached.filter(level => level.warehouse_id === warehouseId);
      }
      return cached;
    }

    const query = this.stockItemRepo
      .createQueryBuilder('stock')
      .where('stock.product_id = :productId', { productId });

    if (warehouseId) {
      query.andWhere('stock.warehouse_id = :warehouseId', { warehouseId });
    }

    const items = await query.getMany();
    const levels = items.map((item) => ({
      product_id: item.product_id,
      warehouse_id: item.warehouse_id,
      quantity: item.quantity,
      reserved_quantity: item.reserved_quantity,
      available_quantity: item.quantity - item.reserved_quantity,
      minimum_threshold: item.minimum_threshold,
      is_low_stock: item.quantity - item.reserved_quantity <= item.minimum_threshold,
      last_updated: item.last_updated,
    }));

    if (!warehouseId) {
      await this.cache.setStock(productId, levels);
    }

    return levels;
  }

  async getStockLevelBatch(productIds: string[]): Promise<Map<string, StockLevel[]>> {
    const result = new Map<string, StockLevel[]>();

    const items = await this.stockItemRepo.find({
      where: { product_id: In(productIds) },
    });

    for (const productId of productIds) {
      const productItems = items.filter((item) => item.product_id === productId);
      const levels = productItems.map((item) => ({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        quantity: item.quantity,
        reserved_quantity: item.reserved_quantity,
        available_quantity: item.quantity - item.reserved_quantity,
        minimum_threshold: item.minimum_threshold,
        is_low_stock: item.quantity - item.reserved_quantity <= item.minimum_threshold,
        last_updated: item.last_updated,
      }));

      result.set(productId, levels);
    }

    return result;
  }

  async recordMovement(
    productId: string,
    warehouseId: string,
    movement: Omit<StockMovement, 'id' | 'created_at'>,
    userId: string,
  ): Promise<StockMovement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Load stock item with PESSIMISTIC WRITE LOCK
      const stockItem = await queryRunner.manager
        .createQueryBuilder(StockItemEntity, 'stock')
        .where('stock.product_id = :productId', { productId })
        .andWhere('stock.warehouse_id = :warehouseId', { warehouseId })
        .setLock('pessimistic_write') // SELECT ... FOR UPDATE
        .getOne();

      if (!stockItem) {
        throw new Error(`Stock item not found for product ${productId} in warehouse ${warehouseId}`);
      }

      const previousQuantity = stockItem.quantity;
      const newQuantity = previousQuantity + movement.quantity;

      // Validate non-negative quantity
      if (newQuantity < 0) {
        throw new Error(
          `Cannot record movement: would result in negative quantity (${newQuantity}) for product ${productId}`
        );
      }

      stockItem.quantity = newQuantity;
      stockItem.last_updated = new Date();

      await queryRunner.manager.save(stockItem);

      const movementEntity = this.movementRepo.create({
        id: this.generateId(),
        product_id: productId,
        warehouse_id: warehouseId,
        movement_type: movement.movement_type as StockMovementType,
        quantity: movement.quantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        reason: movement.reason,
        reference_type: movement.reference_type as ReferenceType,
        reference_id: movement.reference_id,
        created_by: userId,
      });

      const saved = await queryRunner.manager.save(movementEntity);
      await queryRunner.commitTransaction();

      await this.cache.invalidate(productId);

      return {
        id: saved.id,
        product_id: saved.product_id,
        warehouse_id: saved.warehouse_id,
        movement_type: saved.movement_type,
        quantity: saved.quantity,
        previous_quantity: saved.previous_quantity,
        new_quantity: saved.new_quantity,
        reason: saved.reason,
        reference_type: saved.reference_type,
        reference_id: saved.reference_id,
        created_at: saved.created_at,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record movement for product ${productId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getMovementHistory(
    productId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number; offset?: number; warehouseId?: string },
  ): Promise<StockMovement[]> {
    const query = this.movementRepo
      .createQueryBuilder('movement')
      .where('movement.product_id = :productId', { productId })
      .orderBy('movement.created_at', 'DESC');

    if (options?.warehouseId) {
      query.andWhere('movement.warehouse_id = :warehouseId', { warehouseId: options.warehouseId });
    }

    if (options?.startDate) {
      query.andWhere('movement.created_at >= :startDate', { startDate: options.startDate });
    }

    if (options?.endDate) {
      query.andWhere('movement.created_at <= :endDate', { endDate: options.endDate });
    }

    if (options?.limit) {
      query.limit(options.limit);
    }

    if (options?.offset) {
      query.offset(options.offset);
    }

    const movements = await query.getMany();

    return movements.map((m) => ({
      id: m.id,
      product_id: m.product_id,
      warehouse_id: m.warehouse_id,
      movement_type: m.movement_type,
      quantity: m.quantity,
      previous_quantity: m.previous_quantity,
      new_quantity: m.new_quantity,
      reason: m.reason,
      reference_type: m.reference_type,
      reference_id: m.reference_id,
      created_at: m.created_at,
    }));
  }

  async createReservation(
    orderId: string,
    items: { product_id: string; quantity: number; warehouse_id: string }[],
    expiresAt: Date,
  ): Promise<StockReservation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // CRITICAL: Sort items by product_id then warehouse_id to prevent deadlocks
      // This ensures consistent lock acquisition order across concurrent transactions
      const sortedItems = [...items].sort((a, b) => {
        const productCompare = a.product_id.localeCompare(b.product_id);
        if (productCompare !== 0) return productCompare;
        return a.warehouse_id.localeCompare(b.warehouse_id);
      });

      // Load stock items with PESSIMISTIC WRITE LOCK (FOR UPDATE)
      // This prevents concurrent modifications until transaction commits
      const stockItemsToUpdate: StockItemEntity[] = [];

      for (const item of sortedItems) {
        const stockItem = await queryRunner.manager
          .createQueryBuilder(StockItemEntity, 'stock')
          .where('stock.product_id = :productId', { productId: item.product_id })
          .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: item.warehouse_id })
          .setLock('pessimistic_write') // SELECT ... FOR UPDATE
          .getOne();

        if (!stockItem) {
          throw new Error(
            `Stock item not found for product ${item.product_id} in warehouse ${item.warehouse_id}`,
          );
        }

        stockItemsToUpdate.push(stockItem);
      }

      // Create a map for O(1) lookup
      const stockItemMap = new Map(
        stockItemsToUpdate.map(si => [`${si.product_id}:${si.warehouse_id}`, si]),
      );

      // Validate availability and prepare batch updates
      const itemsToUpdate: StockItemEntity[] = [];
      for (const item of sortedItems) {
        const stockItem = stockItemMap.get(`${item.product_id}:${item.warehouse_id}`);

        if (!stockItem) {
          throw new Error(
            `Stock item not found for product ${item.product_id} in warehouse ${item.warehouse_id}`,
          );
        }

        const available = stockItem.quantity - stockItem.reserved_quantity;
        if (available < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${item.product_id}: available ${available}, requested ${item.quantity}`,
          );
        }

        stockItem.reserved_quantity += item.quantity;
        itemsToUpdate.push(stockItem);
      }

      // Batch save all stock items in one operation
      await queryRunner.manager.save(itemsToUpdate);

      const reservation = this.reservationRepo.create({
        id: this.generateId(),
        order_id: orderId,
        items,
        status: ReservationStatus.ACTIVE,
        expires_at: expiresAt,
      });

      const saved = await queryRunner.manager.save(reservation);
      await queryRunner.commitTransaction();

      // Batch invalidate cache
      const uniqueProductIds = [...new Set(items.map(item => item.product_id))];
      await Promise.all(uniqueProductIds.map(productId => this.cache.invalidate(productId)));

      return {
        id: saved.id,
        order_id: saved.order_id,
        items: saved.items,
        status: saved.status,
        expires_at: saved.expires_at,
        created_at: saved.created_at,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create reservation for order ${orderId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateReservation(reservation: StockReservation): Promise<void> {
    // This is primarily for status updates or extension involved in business logic
    // For now we map interface to entity logic if needed, but primary updates happen via specific methods
    // If we receive the interface, we can update the entity.
    await this.reservationRepo.update({ id: reservation.id }, {
      status: reservation.status as ReservationStatus,
      expires_at: reservation.expires_at
    });
  }

  async getReservation(reservationId: string): Promise<StockReservation | null> {
    const reservation = await this.reservationRepo.findOne({ where: { id: reservationId } });
    if (!reservation) return null;
    return {
      id: reservation.id,
      order_id: reservation.order_id,
      items: reservation.items,
      status: reservation.status,
      expires_at: reservation.expires_at,
      created_at: reservation.created_at,
    };
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reservation = await queryRunner.manager.findOne(StockReservationEntity, {
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error(`Reservation not found: ${reservationId}`);
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        // Already released or cancelled - log warning
        this.logger.warn(`Attempted to release non-active reservation ${reservationId}`, {
          status: reservation.status,
        });
        await queryRunner.rollbackTransaction();
        return;
      }

      // Sort items for consistent lock order (prevent deadlocks)
      const sortedItems = [...reservation.items].sort((a, b) => {
        const productCompare = a.product_id.localeCompare(b.product_id);
        if (productCompare !== 0) return productCompare;
        return a.warehouse_id.localeCompare(b.warehouse_id);
      });

      // Load stock items with PESSIMISTIC WRITE LOCK
      const stockItems: StockItemEntity[] = [];

      for (const item of sortedItems) {
        const stockItem = await queryRunner.manager
          .createQueryBuilder(StockItemEntity, 'stock')
          .where('stock.product_id = :productId', { productId: item.product_id })
          .andWhere('stock.warehouse_id = :warehouseId', { warehouseId: item.warehouse_id })
          .setLock('pessimistic_write') // SELECT ... FOR UPDATE
          .getOne();

        if (!stockItem) {
          throw new Error(
            `Stock item not found for product ${item.product_id} in warehouse ${item.warehouse_id}`,
          );
        }

        stockItems.push(stockItem);
      }

      // Create a map for O(1) lookup
      const stockItemMap = new Map(
        stockItems.map(si => [`${si.product_id}:${si.warehouse_id}`, si]),
      );

      // Update reservation quantities in memory
      const itemsToUpdate: StockItemEntity[] = [];
      for (const item of sortedItems) {
        const stockItem = stockItemMap.get(`${item.product_id}:${item.warehouse_id}`);

        if (stockItem) {
          stockItem.reserved_quantity = Math.max(0, stockItem.reserved_quantity - item.quantity);
          itemsToUpdate.push(stockItem);
        }
      }

      // Batch save all stock items in one operation
      await queryRunner.manager.save(itemsToUpdate);

      reservation.status = ReservationStatus.CANCELLED;
      await queryRunner.manager.save(reservation);

      await queryRunner.commitTransaction();

      // Batch invalidate cache
      const uniqueProductIds = [...new Set(reservation.items.map(item => item.product_id))];
      await Promise.all(uniqueProductIds.map(productId => this.cache.invalidate(productId)));
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to release reservation ${reservationId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createLowStockAlert(alert: Omit<LowStockAlert, 'id' | 'created_at'>): Promise<LowStockAlert> {
    const entity = this.alertRepo.create({
      id: this.generateId(),
      ...alert,
      severity: alert.severity as AlertSeverity
    });

    const saved = await this.alertRepo.save(entity);

    return {
      id: saved.id,
      product_id: saved.product_id,
      product_sku: saved.product_sku,
      product_name: saved.product_name,
      warehouse_id: saved.warehouse_id,
      current_quantity: saved.current_quantity,
      minimum_threshold: saved.minimum_threshold,
      severity: saved.severity,
      acknowledged: saved.acknowledged,
      acknowledged_by: saved.acknowledged_by,
      acknowledged_at: saved.acknowledged_at,
      created_at: saved.created_at,
    };
  }

  async getLowStockAlerts(filters?: { acknowledged?: boolean; severity?: string }): Promise<LowStockAlert[]> {
    return this.getAlerts(filters?.acknowledged ?? false); // Reuse getAlerts logic or implement filter here
  }

  async getAlerts(resolved: boolean): Promise<LowStockAlert[]> {
    const query = this.alertRepo.createQueryBuilder('alert');

    // strict boolean check 
    query.where('alert.acknowledged = :acknowledged', { acknowledged: resolved });

    const alerts = await query.orderBy('alert.created_at', 'DESC').getMany();

    return alerts.map((a) => ({
      id: a.id,
      product_id: a.product_id,
      product_sku: a.product_sku,
      product_name: a.product_name,
      warehouse_id: a.warehouse_id,
      current_quantity: a.current_quantity,
      minimum_threshold: a.minimum_threshold,
      severity: a.severity,
      acknowledged: a.acknowledged,
      acknowledged_by: a.acknowledged_by,
      acknowledged_at: a.acknowledged_at,
      created_at: a.created_at,
    }));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.alertRepo.update(
      { id: alertId },
      {
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date(),
      },
    );
  }

  async getWarehouses(): Promise<Warehouse[]> {
    const warehouses = await this.warehouseRepo
      .createQueryBuilder('warehouse')
      .where('warehouse.is_active = :active', { active: true })
      .orderBy('warehouse.priority', 'ASC')
      .getMany();

    return warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      priority: w.priority,
      is_active: w.is_active,
      smartbill_id: w.smartbill_id,
      created_at: w.created_at,
    }));
  }

  async adjustStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    reason: string,
    userId: string,
  ): Promise<void> {
    const movement = {
      movement_type: StockMovementType.ADJUSTMENT,
      quantity,
      reason,
      reference_type: ReferenceType.MANUAL_ADJUSTMENT,
      reference_id: undefined,
    };

    // Cast movement to match Omit<StockMovement, 'id' | 'created_at'> 
    // Typescript might complain about undefined reference_id matching optional string
    // We can cast or ensure types match. 
    // ReferenceType cast is already done in recordMovement
    await this.recordMovement(productId, warehouseId, movement as any, userId);
  }

  async getStockItem(productId: string, warehouseId: string): Promise<any> {
    return this.stockItemRepo.findOne({ where: { product_id: productId, warehouse_id: warehouseId } });
  }

  private generateId(): string {
    return uuidv4();
  }
}
