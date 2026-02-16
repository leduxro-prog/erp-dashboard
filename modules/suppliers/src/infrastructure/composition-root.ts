import { Router } from 'express';
import { DataSource, Repository } from 'typeorm';
import { SupplierController } from '../api/controllers/SupplierController';
import { createSupplierRoutes } from '../api/routes/supplier.routes';
import { ScrapeSupplierStock } from '../application/use-cases/ScrapeSupplierStock';
import { MapSku } from '../application/use-cases/MapSku';
import { PlaceSupplierOrder } from '../application/use-cases/PlaceSupplierOrder';
import { GetSupplierProducts } from '../application/use-cases/GetSupplierProducts';
import { TypeOrmSupplierRepository } from './repositories/TypeOrmSupplierRepository';
import { SupplierSyncJob } from './jobs/SupplierSyncJob';
import { SupplierEntityDb } from './entities/SupplierEntityDb';
import { SupplierProductEntityDb } from './entities/SupplierProductEntityDb';
import { SkuMappingEntityDb } from './entities/SkuMappingEntityDb';
import { SupplierOrderEntityDb } from './entities/SupplierOrderEntityDb';

/**
 * Composition Root for Suppliers Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function createSuppliersRouter(dataSource: DataSource): Router {
  // Get TypeORM repositories from DataSource
  const supplierRepo = dataSource.getRepository(SupplierEntityDb);
  const supplierProductRepo = dataSource.getRepository(SupplierProductEntityDb);
  const skuMappingRepo = dataSource.getRepository(SkuMappingEntityDb);
  const supplierOrderRepo = dataSource.getRepository(SupplierOrderEntityDb);

  // Instantiate TypeORM repository with all required repositories
  const supplierRepository = new TypeOrmSupplierRepository(
    supplierRepo,
    supplierProductRepo,
    skuMappingRepo,
    supplierOrderRepo
  );

  // Instantiate infrastructure services with proper Redis config
  const redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  const supplierSyncJob = new SupplierSyncJob(supplierRepository, redisConfig);

  // Instantiate use-cases with injected repositories
  // Note: ScrapeSupplierStock is created inside SupplierSyncJob, so we don't instantiate it here
  const mapSku = new MapSku(supplierRepository);
  const placeSupplierOrder = new PlaceSupplierOrder(supplierRepository);
  const getSupplierProducts = new GetSupplierProducts(supplierRepository);

  // Instantiate controller with injected dependencies
  const controller = new SupplierController(
    supplierRepository,
    supplierSyncJob,
  );

  // Create and return configured Express router
  return createSupplierRoutes(supplierRepository, supplierSyncJob);
}
