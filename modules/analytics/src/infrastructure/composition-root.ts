import { Router } from 'express';
import { DataSource } from 'typeorm';
// import { Logger } from 'winston';
import { createModuleLogger } from '@shared/utils/logger';

// Domain repositories (interfaces)
import {
  IDashboardRepository,
  IReportRepository,
  IMetricRepository,
  // IForecastRepository,
} from '../domain/repositories';

// Use-cases
import {
  GetSalesDashboard,
  GenerateReport,
} from '../application/use-cases';

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmDashboardRepository } from './repositories/TypeOrmDashboardRepository';
import { TypeOrmReportRepository } from './repositories/TypeOrmReportRepository';
import { TypeOrmMetricRepository } from './repositories/TypeOrmMetricRepository';
import { TypeOrmForecastRepository } from './repositories/TypeOrmForecastRepository';

// Controller
import { AnalyticsController } from '../api/controllers/AnalyticsController';

// Routes
import { createAnalyticsRoutes } from '../api/routes/analytics.routes';
import { IOrderDataPort } from '../application/ports/IOrderDataPort';
import { IPricingDataPort } from '../application/ports/IPricingDataPort';
import { IInventoryDataPort } from '../application/ports/IInventoryDataPort';
import { ICustomerDataPort } from '../application/ports/ICustomerDataPort';
import { ISupplierDataPort } from '../application/ports/ISupplierDataPort';
import { INotificationPort } from '../application/ports/INotificationPort';

// Mock adapters for ports (to be replaced with real adapters)
const mockOrderDataPort = {} as IOrderDataPort;
const mockPricingDataPort = {} as IPricingDataPort;
const mockInventoryDataPort = {} as IInventoryDataPort;
const mockCustomerDataPort = {} as ICustomerDataPort;
const mockSupplierDataPort = {} as ISupplierDataPort;
const mockNotificationPort = {} as INotificationPort;

/**
 * Analytics Module Composition Root
 * Orchestrates dependency injection and creates configured Express router
 */
export function createAnalyticsRouter(dataSource: DataSource): Router {
  const logger = createModuleLogger('analytics');

  // Initialize repositories
  const dashboardRepository: IDashboardRepository = new TypeOrmDashboardRepository(dataSource);
  const reportRepository: IReportRepository = new TypeOrmReportRepository(dataSource);
  const metricRepository: IMetricRepository = new TypeOrmMetricRepository(dataSource);
  // const forecastRepository: IForecastRepository = new TypeOrmForecastRepository(dataSource);
  // To shut up TS:
  new TypeOrmForecastRepository(dataSource);

  // Initialize use-cases
  const getSalesDashboard = new GetSalesDashboard(
    dashboardRepository,
    mockOrderDataPort,
    mockPricingDataPort,
    logger
  );

  const generateReport = new GenerateReport(
    reportRepository,
    mockOrderDataPort,
    mockInventoryDataPort,
    mockCustomerDataPort,
    mockSupplierDataPort,
    mockNotificationPort,
    logger
  );

  // Initialize controller
  const controller = new AnalyticsController(
    getSalesDashboard,
    generateReport,
    dashboardRepository,
    reportRepository,
    metricRepository,
    logger
  );

  // Create and return configured Express router
  return createAnalyticsRoutes(controller);
}
