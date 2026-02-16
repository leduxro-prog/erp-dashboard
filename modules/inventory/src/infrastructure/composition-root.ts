/**
 * Inventory Module Composition Root
 * Orchestrates dependency injection and creates configured Express router
 */

import { Router } from 'express';
import { DataSource } from 'typeorm';
import { InventoryController } from '../api/controllers/InventoryController';
import { createInventoryRoutes } from '../api/routes/inventory.routes';
import { CheckStock } from '../application/use-cases/CheckStock';
import { ReserveStock } from '../application/use-cases/ReserveStock';
import { ReleaseStock } from '../application/use-cases/ReleaseStock';
import { AdjustStock } from '../application/use-cases/AdjustStock';
import { GetLowStockAlerts } from '../application/use-cases/GetLowStockAlerts';
import { GetMovementHistory } from '../application/use-cases/GetMovementHistory';
import { GetWarehouses } from '../application/use-cases/GetWarehouses';
import { TypeOrmInventoryRepository } from './repositories/TypeOrmInventoryRepository';
import Redis from 'ioredis';
import { StockCache } from './cache/StockCache';

/**
 * Create Inventory Router
 * Factory function that wires all dependencies and returns configured Express router
 *
 * @param dataSource - TypeORM DataSource for database access
 * @returns Configured Express Router with all inventory endpoints
 */
export function createInventoryRouter(dataSource: DataSource): Router {
  // Instantiate shared infrastructure
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  const stockCache = new StockCache(redis);

  // Instantiate TypeORM repository for database operations
  const inventoryRepository = new TypeOrmInventoryRepository(dataSource, stockCache);

  // Instantiate use-cases with injected repository
  const checkStock = new CheckStock(inventoryRepository);
  const reserveStock = new ReserveStock(inventoryRepository);
  const releaseStock = new ReleaseStock(inventoryRepository);
  const adjustStock = new AdjustStock(inventoryRepository);
  const getLowStockAlerts = new GetLowStockAlerts(inventoryRepository);
  const getMovementHistory = new GetMovementHistory(inventoryRepository);
  const getWarehouses = new GetWarehouses(inventoryRepository);

  // Instantiate controller with all injected use-cases
  const controller = new InventoryController(
    checkStock,
    reserveStock,
    releaseStock,
    adjustStock,
    getLowStockAlerts,
    getMovementHistory,
    getWarehouses,
    dataSource
  );

  // Create and return configured Express router
  return createInventoryRoutes(controller);
}
