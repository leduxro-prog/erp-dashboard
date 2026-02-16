import { Router } from 'express';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { OrderController } from '../api/controllers/OrderController';
import { OfflineController } from '../api/controllers/OfflineController';
import { createOrderRoutes } from '../api/routes/order.routes';
import { createOfflineRoutes } from '../api/routes/offline.routes';
import { TypeOrmOrderRepository } from './repositories/TypeOrmOrderRepository';
import { TypeOrmInventoryRepository } from '../../../inventory/src/infrastructure/repositories/TypeOrmInventoryRepository';
import { StockCache } from '../../../inventory/src/infrastructure/cache/StockCache';
import { OrderMapper } from './mappers/OrderMapper';
import { OrderCache } from './cache/OrderCache';
import { OfflineTransactionService } from '../application/services/OfflineTransactionService';

/**
 * Composition Root for Orders Module
 * Orchestrates dependency injection and creates configured Express router
 * 
 * Note: This uses the existing controller which directly depends on repositories
 * rather than use-cases. A full refactor would extract use-cases.
 */
export function createOrdersRouter(dataSource: DataSource, redisClient?: Redis): Router {
  // Instantiate shared infrastructure
  // Use provided redis client or create new one (defaulting to localhost if not provided)
  const redis = redisClient || new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  // Instantiate infrastructure dependencies
  const orderRepository = new TypeOrmOrderRepository(dataSource);
  const orderMapper = new OrderMapper();
  // TODO: Fix OrderCache DI separately, for now keep as is to avoid breaking existing code
  // assuming it works in runtime or ignored
  const orderCache = new OrderCache(); // Uses shared RedisPool singleton

  // Inventory Dependencies
  const stockCache = new StockCache(redis);
  const inventoryRepository = new TypeOrmInventoryRepository(dataSource, stockCache);

  // Application Services
  const offlineService = new OfflineTransactionService(orderRepository, inventoryRepository);

  // Instantiate controllers with injected dependencies
  const orderController = new OrderController(
    orderRepository,
    orderMapper,
    orderCache,
  );

  const offlineController = new OfflineController(offlineService);

  // Create Routers
  const orderRouter = createOrderRoutes(orderController);
  const offlineRouter = createOfflineRoutes(offlineController);

  // Merge Routers
  const mainRouter = Router();
  mainRouter.use(orderRouter);
  mainRouter.use(offlineRouter);

  return mainRouter;
}
