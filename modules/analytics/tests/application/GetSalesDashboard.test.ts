import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Logger } from 'winston';
import { GetSalesDashboard } from '../../src/application/use-cases/GetSalesDashboard';
import { IDashboardRepository } from '../../src/domain/repositories/IDashboardRepository';
import { IOrderDataPort } from '../../src/application/ports/IOrderDataPort';
import { IPricingDataPort } from '../../src/application/ports/IPricingDataPort';
import { Dashboard } from '../../src/domain/entities/Dashboard';

/**
 * GetSalesDashboard Use-Case Integration Tests
 *
 * Tests the sales dashboard retrieval flow:
 * - Fetching existing dashboard
 * - Creating dashboard if not exists
 * - Updating widget caches with fresh data
 * - Error handling for data sources
 */
describe('GetSalesDashboard Use-Case', () => {
  let useCase: GetSalesDashboard;
  let dashboardRepository: jest.Mocked<IDashboardRepository>;
  let orderDataPort: jest.Mocked<IOrderDataPort>;
  let pricingDataPort: jest.Mocked<IPricingDataPort>;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create mocks
    dashboardRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByOwner: jest.fn(),
      findShared: jest.fn(),
      findDefault: jest.fn(),
      delete: jest.fn(),
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

    useCase = new GetSalesDashboard(
      dashboardRepository,
      orderDataPort,
      pricingDataPort,
      logger
    );
  });

  describe('Successful Dashboard Retrieval', () => {
    it('should retrieve existing sales dashboard', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system',
        true,
        false
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 150,
        totalRevenue: 450000,
        avgOrderValue: 3000,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      const result = await useCase.execute('user-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('sales-dashboard-system');
      expect(dashboardRepository.findById).toHaveBeenCalledWith('sales-dashboard-system');
    });

    it('should create dashboard if not exists', async () => {
      dashboardRepository.findById.mockResolvedValue(null);
      dashboardRepository.save.mockResolvedValue(
        new Dashboard(
          'sales-dashboard-system',
          'Sales Dashboard',
          'Real-time sales metrics',
          'system'
        )
      );
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 150,
        totalRevenue: 450000,
        avgOrderValue: 3000,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      const result = await useCase.execute('user-123');

      expect(dashboardRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Sales Dashboard');
    });

    it('should fetch fresh data for widgets', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 250,
        totalRevenue: 750000,
        avgOrderValue: 3000,
        statusBreakdown: { PAID: 200, PENDING: 50 },
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      await useCase.execute('user-123');

      expect(orderDataPort.getOrderMetrics).toHaveBeenCalled();
      expect(pricingDataPort.getRevenueByTier).toHaveBeenCalled();
    });

    it('should log operation successfully', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 150,
        totalRevenue: 450000,
        avgOrderValue: 3000,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      await useCase.execute('user-456');

      expect(logger.info).toHaveBeenCalledWith('Getting sales dashboard', {
        userId: 'user-456',
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Sales dashboard retrieved successfully',
        expect.objectContaining({
          userId: 'user-456',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle order data fetch failure', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockRejectedValue(
        new Error('Order service unavailable')
      );

      await expect(useCase.execute('user-123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get sales dashboard',
        expect.objectContaining({
          userId: 'user-123',
        })
      );
    });

    it('should handle pricing data fetch failure', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 150,
        totalRevenue: 450000,
        avgOrderValue: 3000,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockRejectedValue(
        new Error('Pricing service unavailable')
      );

      await expect(useCase.execute('user-123')).rejects.toThrow();
    });

    it('should handle dashboard creation failure', async () => {
      dashboardRepository.findById.mockResolvedValue(null);
      dashboardRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute('user-123')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Data Validation', () => {
    it('should handle empty order data', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      const result = await useCase.execute('user-123');

      expect(result).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        'Sales dashboard retrieved successfully',
        expect.any(Object)
      );
    });

    it('should handle large dataset', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 100000,
        totalRevenue: 30000000,
        avgOrderValue: 300,
        statusBreakdown: { PAID: 95000, PENDING: 5000 },
        topProducts: Array(100)
          .fill(0)
          .map((_, i) => ({
            productId: `prod-${i}`,
            revenue: Math.random() * 100000,
            orderCount: Math.floor(Math.random() * 1000),
          })),
        revenueByTier: [],
        dailyOrders: Array(30)
          .fill(0)
          .map((_, i) => ({
            date: `2024-02-${String(i + 1).padStart(2, '0')}`,
            count: Math.floor(Math.random() * 5000),
          })),
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      const result = await useCase.execute('user-123');

      expect(result).toBeDefined();
    });
  });

  describe('User Context', () => {
    it('should include userId in logging', async () => {
      const mockDashboard = new Dashboard(
        'sales-dashboard-system',
        'Sales Dashboard',
        'Real-time sales metrics',
        'system'
      );

      dashboardRepository.findById.mockResolvedValue(mockDashboard);
      orderDataPort.getOrderMetrics.mockResolvedValue({
        totalOrders: 150,
        totalRevenue: 450000,
        avgOrderValue: 3000,
        statusBreakdown: {},
        topProducts: [],
        revenueByTier: [],
        dailyOrders: [],
        dailyRevenue: [],
      });
      pricingDataPort.getRevenueByTier.mockResolvedValue([]);

      const userId = 'user-789';
      await useCase.execute(userId);

      expect(logger.info).toHaveBeenCalledWith(
        'Getting sales dashboard',
        expect.objectContaining({
          userId,
        })
      );
    });
  });
});
