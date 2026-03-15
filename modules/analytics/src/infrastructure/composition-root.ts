import { createModuleLogger } from '@shared/utils/logger';
import { Router } from 'express';
import { IModuleContext } from '@shared/module-system/module.interface';

// Domain repositories (interfaces)
import { AnalyticsController } from '../api/controllers/AnalyticsController';
import { createAnalyticsRoutes } from '../api/routes/analytics.routes';
import { ICustomerDataPort } from '../application/ports/ICustomerDataPort';
import { IInventoryDataPort } from '../application/ports/IInventoryDataPort';
import { INotificationPort } from '../application/ports/INotificationPort';
import { ISupplierDataPort } from '../application/ports/ISupplierDataPort';
import {
  GetSalesDashboard,
  GenerateReport,
} from '../application/use-cases';
import {
  IDashboardRepository,
  IReportRepository,
  IMetricRepository,
} from '../domain/repositories';

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmDashboardRepository } from './repositories/TypeOrmDashboardRepository';
import { TypeOrmForecastRepository } from './repositories/TypeOrmForecastRepository';
import { TypeOrmMetricRepository } from './repositories/TypeOrmMetricRepository';
import { TypeOrmReportRepository } from './repositories/TypeOrmReportRepository';

// Adapters
import { OrderDataAdapter } from './adapters/OrderDataAdapter';
import { PricingDataAdapter } from './adapters/PricingDataAdapter';

// Mock adapters for ports (to be replaced with real adapters)
const mockInventoryDataPort = {} as IInventoryDataPort;
const mockCustomerDataPort = {} as ICustomerDataPort;
const mockSupplierDataPort = {} as ISupplierDataPort;
const mockNotificationPort = {} as INotificationPort;

/**
 * Analytics Module Composition Root
 * Orchestrates dependency injection and creates configured Express router
 */
export function createAnalyticsRouter(context: IModuleContext): Router {
  const logger = createModuleLogger('analytics');
  const { dataSource, cacheManager } = context;

  // Initialize repositories
  const dashboardRepository: IDashboardRepository = new TypeOrmDashboardRepository(dataSource);
  const reportRepository: IReportRepository = new TypeOrmReportRepository(dataSource);
  const metricRepository: IMetricRepository = new TypeOrmMetricRepository(dataSource);
  
  // Initialize adapters
  const orderDataPort = new OrderDataAdapter(dataSource);
  const pricingDataPort = new PricingDataAdapter(dataSource);

  // Initialize use-cases
  const getSalesDashboard = new GetSalesDashboard(
    dashboardRepository,
    orderDataPort,
    pricingDataPort,
    logger as any,
    cacheManager
  );

  const generateReport = new GenerateReport(
    reportRepository,
    orderDataPort,
    mockInventoryDataPort,
    mockCustomerDataPort,
    mockSupplierDataPort,
    mockNotificationPort,
    logger as any
  );

  // Initialize controller
  const controller = new AnalyticsController(
    getSalesDashboard,
    generateReport,
    dashboardRepository,
    reportRepository,
    metricRepository,
    logger as any
  );

  // Create and return configured Express router
  return createAnalyticsRoutes(controller);
}
