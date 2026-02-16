/**
 * GetCampaignAnalytics Use Case Tests
 * Tests analytics retrieval with ROI calculations
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetCampaignAnalytics, GetCampaignAnalyticsInput } from '../../src/application/use-cases/GetCampaignAnalytics';
import { CampaignNotFoundError } from '../../src/domain/errors/marketing.errors';

describe('GetCampaignAnalytics Use Case', () => {
  let useCase: GetCampaignAnalytics;
  let mockCampaignRepository: any;
  let mockMarketingEventRepository: any;

  beforeEach(() => {
    mockCampaignRepository = {
      findById: jest.fn(),
    };

    mockMarketingEventRepository = {
      getTimeSeriesData: jest.fn(),
    };

    useCase = new GetCampaignAnalytics(mockCampaignRepository, mockMarketingEventRepository);
  });

  describe('Happy Path - Analytics Retrieval', () => {
    it('should retrieve campaign analytics successfully', async () => {
      const campaign = createMockCampaign('camp-001', 'EMAIL Campaign', 10000, 2000);
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-001',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBe('camp-001');
      expect(result.campaign.name).toBe('EMAIL Campaign');
      expect(result.metrics.sent).toBe(1000);
      expect(result.metrics.opened).toBe(500);
      expect(result.metrics.clicked).toBe(100);
      expect(result.metrics.converted).toBe(10);
      expect(result.metrics.revenue).toBe(5000);
    });

    it('should calculate open rate correctly', async () => {
      const campaign = createMockCampaign('camp-002', 'SMS Campaign', 10000, 3000);
      campaign.metrics.sent = 1000;
      campaign.metrics.opened = 500;
      campaign.getOpenRate = () => 0.5; // 50%

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-002',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.rates.openRate).toBe(0.5);
    });

    it('should calculate click rate correctly', async () => {
      const campaign = createMockCampaign('camp-003', 'Social Campaign', 5000, 1000);
      campaign.metrics.sent = 2000;
      campaign.metrics.clicked = 200;
      campaign.getClickRate = () => 0.1; // 10%

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-003',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.rates.clickRate).toBe(0.1);
    });

    it('should calculate conversion rate correctly', async () => {
      const campaign = createMockCampaign('camp-004', 'Conversion Campaign', 20000, 5000);
      campaign.metrics.sent = 5000;
      campaign.metrics.converted = 500;
      campaign.getConversionRate = () => 0.1; // 10%

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-004',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.rates.conversionRate).toBe(0.1);
    });

    it('should calculate ROI correctly', async () => {
      const campaign = createMockCampaign('camp-005', 'ROI Campaign', 10000, 3000);
      campaign.budget = 5000;
      campaign.spentBudget = 5000;
      campaign.metrics.revenue = 20000; // 20000 - 5000 = 15000 profit
      campaign.getROI = () => 3.0; // 300% ROI

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-005',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.rates.roi).toBe(3.0);
    });

    it('should calculate budget information correctly', async () => {
      const campaign = createMockCampaign('camp-006', 'Budget Test', 10000, 2000);
      campaign.budget = 50000;
      campaign.spentBudget = 30000;
      campaign.getRemainingBudget = () => 20000;

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-006',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.budget.allocated).toBe(50000);
      expect(result.budget.spent).toBe(30000);
      expect(result.budget.remaining).toBe(20000);
      expect(result.budget.percentageUsed).toBe(60); // 30000 / 50000 * 100
    });

    it('should handle campaign without budget', async () => {
      const campaign = createMockCampaign('camp-007', 'No Budget Campaign', 10000, 2000);
      campaign.budget = null;
      campaign.spentBudget = 0;
      campaign.getRemainingBudget = () => null;

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-007',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.budget.allocated).toBeNull();
      expect(result.budget.remaining).toBeNull();
      expect(result.budget.percentageUsed).toBeNull();
    });
  });

  describe('Time-Series Data', () => {
    it('should retrieve time-series data for default period', async () => {
      const campaign = createMockCampaign('camp-008', 'Time Series Test', 10000, 2000);
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-008',
      };

      const timeSeriesEvents = [
        { date: new Date('2025-02-01'), revenue: 1000 },
        { date: new Date('2025-02-02'), revenue: 1500 },
        { date: new Date('2025-02-03'), revenue: 2000 },
      ];

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue(timeSeriesEvents);

      const result = await useCase.execute(input);

      expect(result.timeSeriesData).toHaveLength(3);
      expect(result.timeSeriesData[0].date).toEqual(new Date('2025-02-01'));
    });

    it('should support custom date range for time-series', async () => {
      const campaign = createMockCampaign('camp-009', 'Custom Range Test', 10000, 2000);
      const startDate = new Date('2025-02-01');
      const endDate = new Date('2025-02-28');

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-009',
        startDate,
        endDate,
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      await useCase.execute(input);

      expect(mockMarketingEventRepository.getTimeSeriesData).toHaveBeenCalledWith(
        'camp-009',
        startDate,
        endDate,
        'day'
      );
    });

    it('should support hourly grouping', async () => {
      const campaign = createMockCampaign('camp-010', 'Hourly Test', 10000, 2000);
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-010',
        groupBy: 'hour',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      await useCase.execute(input);

      expect(mockMarketingEventRepository.getTimeSeriesData).toHaveBeenCalledWith(
        'camp-010',
        expect.any(Date),
        expect.any(Date),
        'hour'
      );
    });

    it('should support weekly grouping', async () => {
      const campaign = createMockCampaign('camp-011', 'Weekly Test', 10000, 2000);
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-011',
        groupBy: 'week',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      await useCase.execute(input);

      expect(mockMarketingEventRepository.getTimeSeriesData).toHaveBeenCalledWith(
        'camp-011',
        expect.any(Date),
        expect.any(Date),
        'week'
      );
    });

    it('should default to daily grouping', async () => {
      const campaign = createMockCampaign('camp-012', 'Default Group Test', 10000, 2000);
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-012',
        // No groupBy specified
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      await useCase.execute(input);

      expect(mockMarketingEventRepository.getTimeSeriesData).toHaveBeenCalledWith(
        'camp-012',
        expect.any(Date),
        expect.any(Date),
        'day'
      );
    });
  });

  describe('Error Cases', () => {
    it('should throw CampaignNotFoundError when campaign does not exist', async () => {
      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-nonexistent',
      };

      mockCampaignRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(CampaignNotFoundError);
    });
  });

  describe('Campaign Status', () => {
    it('should include campaign status in response', async () => {
      const campaign = createMockCampaign('camp-013', 'Status Test', 10000, 2000);
      campaign.getStatus = () => 'ACTIVE';

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-013',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.campaign.status).toBe('ACTIVE');
    });

    it('should handle DRAFT status', async () => {
      const campaign = createMockCampaign('camp-014', 'Draft Status', 10000, 2000);
      campaign.getStatus = () => 'DRAFT';

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-014',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.campaign.status).toBe('DRAFT');
    });

    it('should handle COMPLETED status', async () => {
      const campaign = createMockCampaign('camp-015', 'Completed', 10000, 2000);
      campaign.getStatus = () => 'COMPLETED';

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-015',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.campaign.status).toBe('COMPLETED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero metrics', async () => {
      const campaign = createMockCampaign('camp-016', 'Zero Metrics', 0, 0);
      campaign.metrics = { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 };
      campaign.getOpenRate = () => 0;
      campaign.getClickRate = () => 0;
      campaign.getConversionRate = () => 0;
      campaign.getROI = () => 0;

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-016',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.metrics.sent).toBe(0);
      expect(result.rates.openRate).toBe(0);
    });

    it('should handle very large metrics values', async () => {
      const campaign = createMockCampaign('camp-017', 'Large Metrics', 1000000, 500000);
      campaign.metrics = {
        sent: 1000000,
        opened: 750000,
        clicked: 300000,
        converted: 50000,
        revenue: 50000000,
      };

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-017',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.metrics.sent).toBe(1000000);
      expect(result.metrics.revenue).toBe(50000000);
    });

    it('should handle budget edge cases', async () => {
      const campaign = createMockCampaign('camp-018', 'Budget Edge', 10000, 2000);
      campaign.budget = 0.01; // Very small budget
      campaign.spentBudget = 0.01;
      campaign.getRemainingBudget = () => 0;

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-018',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.budget.allocated).toBe(0.01);
      expect(result.budget.percentageUsed).toBe(100);
    });

    it('should include campaign date ranges', async () => {
      const startDate = new Date('2025-02-01');
      const endDate = new Date('2025-02-28');
      const campaign = createMockCampaign('camp-019', 'Date Range Test', 10000, 2000);
      campaign.startDate = startDate;
      campaign.endDate = endDate;

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-019',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.campaign.startDate).toEqual(startDate);
      expect(result.campaign.endDate).toEqual(endDate);
    });

    it('should handle negative ROI', async () => {
      const campaign = createMockCampaign('camp-020', 'Loss Campaign', 10000, 2000);
      campaign.budget = 10000;
      campaign.spentBudget = 10000;
      campaign.metrics.revenue = 5000; // Less than spent
      campaign.getROI = () => -0.5; // -50% ROI

      const input: GetCampaignAnalyticsInput = {
        campaignId: 'camp-020',
      };

      mockCampaignRepository.findById.mockResolvedValue(campaign);
      mockMarketingEventRepository.getTimeSeriesData.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.rates.roi).toBe(-0.5);
    });
  });
});

// Helper function to create mock campaign
function createMockCampaign(id: string, name: string, revenue: number, spent: number): any {
  return {
    id,
    name,
    type: 'EMAIL',
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    budget: 10000,
    spentBudget: spent,
    metrics: {
      sent: 1000,
      opened: 500,
      clicked: 100,
      converted: 10,
      revenue,
    },
    getStatus: () => 'ACTIVE',
    getRemainingBudget: () => 10000 - spent,
    getOpenRate: () => 0.5,
    getClickRate: () => 0.1,
    getConversionRate: () => 0.01,
    getROI: () => revenue / spent - 1,
  };
}
