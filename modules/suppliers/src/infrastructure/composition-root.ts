import { Router } from 'express';
import { DataSource } from 'typeorm';

import { createModuleLogger } from '@shared/utils/logger';

import { createSupplierRoutes } from '../api/routes/supplier.routes';
import { SupplierEntityDb } from './entities/SupplierEntityDb';
import { SupplierOrderEntityDb } from './entities/SupplierOrderEntityDb';
import { SupplierProductEntityDb } from './entities/SupplierProductEntityDb';
import { SkuMappingEntityDb } from './entities/SkuMappingEntityDb';
import { SupplierSyncJob } from './jobs/SupplierSyncJob';
import { TypeOrmSupplierRepository } from './repositories/TypeOrmSupplierRepository';

/**
 * Composition Root for Suppliers Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function createSuppliersRouter(dataSource: DataSource): Router {
  const logger = createModuleLogger('suppliers-composition-root');

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
    supplierOrderRepo,
    dataSource,
  );

  // Instantiate infrastructure services with proper Redis config
  const redisConfig = {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  };
  const supplierSyncJob = new SupplierSyncJob(supplierRepository, redisConfig);

  const supplierSyncAutorun = String(process.env.SUPPLIER_SYNC_AUTORUN ?? 'true').toLowerCase();
  const shouldScheduleSupplierSync = supplierSyncAutorun !== '0' && supplierSyncAutorun !== 'false';

  if (shouldScheduleSupplierSync) {
    void supplierSyncJob.scheduleSync().catch((error) => {
      logger.error('Failed to schedule recurring supplier sync job', { error });
    });
  } else {
    void supplierSyncJob.disableRecurringSync().catch((error) => {
      logger.error('Failed to disable recurring supplier sync job', { error });
    });
    logger.warn('Recurring supplier sync disabled by SUPPLIER_SYNC_AUTORUN');
  }

  // Create and return configured Express router
  return createSupplierRoutes(supplierRepository, supplierSyncJob);
}
