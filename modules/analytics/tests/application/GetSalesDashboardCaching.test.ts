import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Logger } from 'winston';

import { IOrderDataPort } from '../../src/application/ports/IOrderDataPort';
import { IPricingDataPort } from '../../src/application/ports/IPricingDataPort';
import { GetSalesDashboard } from '../../src/application/use-cases/GetSalesDashboard';
import { Dashboard } from '../../src/domain/entities/Dashboard';
import { IDashboardRepository } from '../../src/domain/repositories/IDashboardRepository';

describe('GetSalesDashboard Caching', () => {
  let useCase: GetSalesDashboard;
  let dashboardRepository: jest.Mocked<IDashboardRepository>;
  let orderDataPort: jest.Mocked<IOrderDataPort>;
  let pricingDataPort: jest.Mocked<IPricingDataPort>;
  let logger: jest.Mocked<Logger>;
  let cacheManager: any;

  beforeEach(() => {
    dashboardRepository = {
      save: jest.fn(),
      findById: jest.fn(),
    } as any;

    orderDataPort = {
      getOrderMetrics: jest.fn(),
    } as any;

    pricingDataPort = {
      getRevenueByTier: jest.fn(),
    } as any;

    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    useCase = new GetSalesDashboard(
      dashboardRepository,
      orderDataPort,
      pricingDataPort,
      logger,
      cacheManager
    );
  });

  it('should use cached data if available', async () => {
    const mockDashboard = new Dashboard('sales-dashboard-system', 'Sales Dashboard', '', 'system');
    dashboardRepository.findById.mockResolvedValue(mockDashboard);
    
    const cachedData = {
      orderMetrics: { totalOrders: 100, totalRevenue: 1000, avgOrderValue: 10, dailyRevenue: [] },
      tierRevenue: []
    };
    cacheManager.get.mockResolvedValue(cachedData);

    await useCase.execute('user-123');

    expect(cacheManager.get).toHaveBeenCalled();
    expect(orderDataPort.getOrderMetrics).not.toHaveBeenCalled();
    expect(pricingDataPort.getRevenueByTier).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('Using cached data for sales dashboard');
  });

  it('should fetch fresh data and cache it on miss', async () => {
    const mockDashboard = new Dashboard('sales-dashboard-system', 'Sales Dashboard', '', 'system');
    dashboardRepository.findById.mockResolvedValue(mockDashboard);
    cacheManager.get.mockResolvedValue(null);
    
    orderDataPort.getOrderMetrics.mockResolvedValue({
      totalOrders: 50,
      totalRevenue: 5000,
      avgOrderValue: 100,
      statusBreakdown: {},
      topProducts: [],
      revenueByTier: [],
      dailyOrders: [],
      dailyRevenue: [],
    });
    pricingDataPort.getRevenueByTier.mockResolvedValue([]);

    await useCase.execute('user-123');

    expect(cacheManager.get).toHaveBeenCalled();
    expect(orderDataPort.getOrderMetrics).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalledWith(
      expect.stringContaining('sales_dashboard_data:'),
      expect.objectContaining({
        orderMetrics: expect.objectContaining({ totalOrders: 50 }),
      }),
      'write-through',
      900
    );
  });
});
