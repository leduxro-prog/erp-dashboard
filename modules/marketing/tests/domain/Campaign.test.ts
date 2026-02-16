/**
 * Campaign Entity Tests
 * Unit tests for Campaign domain entity business logic
 *
 * @module Tests/Domain
 */

import { Campaign, CampaignMetrics } from '../../src/domain/entities/Campaign';

describe('Campaign Entity', () => {
  let campaign: Campaign;
  const now = new Date();
  const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days after start

  const initialMetrics: CampaignMetrics = {
    sent: 1000,
    opened: 250,
    clicked: 75,
    converted: 20,
    revenue: 5000,
  };

  beforeEach(() => {
    campaign = new Campaign(
      'camp_001',
      'Summer Sale',
      'SEASONAL',
      'DRAFT',
      'Summer promotional campaign',
      { tiers: ['SILVER', 'GOLD', 'PLATINUM'] },
      startDate,
      endDate,
      5000,
      0,
      { ...initialMetrics },
      'user_123',
      now,
      now
    );
  });

  describe('Campaign Lifecycle', () => {
    it('should start in DRAFT status', () => {
      expect(campaign.getStatus()).toBe('DRAFT');
    });

    it('should activate from DRAFT status', () => {
      campaign.activate();
      expect(campaign.getStatus()).toBe('ACTIVE');
    });

    it('should throw error activating non-DRAFT campaign', () => {
      campaign.activate();
      expect(() => campaign.activate()).toThrow();
    });

    it('should pause active campaign', () => {
      campaign.activate();
      campaign.pause();
      expect(campaign.getStatus()).toBe('PAUSED');
    });

    it('should resume paused campaign', () => {
      campaign.activate();
      campaign.pause();
      campaign.resume();
      expect(campaign.getStatus()).toBe('ACTIVE');
    });

    it('should complete active campaign', () => {
      campaign.activate();
      campaign.complete();
      expect(campaign.getStatus()).toBe('COMPLETED');
    });

    it('should cancel campaign', () => {
      campaign.cancel();
      expect(campaign.getStatus()).toBe('CANCELLED');
    });

    it('should throw error cancelling completed campaign', () => {
      campaign.activate();
      campaign.complete();
      expect(() => campaign.cancel()).toThrow();
    });
  });

  describe('Campaign Status Checks', () => {
    it('should correctly identify active campaign', () => {
      campaign.activate();
      expect(campaign.isActive()).toBe(true);
    });

    it('should correctly identify inactive campaign', () => {
      expect(campaign.isActive()).toBe(false);
    });

    it('should identify expired campaign', () => {
      const expiredCampaign = new Campaign(
        'camp_002',
        'Expired Sale',
        'FLASH_SALE',
        'COMPLETED',
        'Past campaign',
        {},
        new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        1000,
        500,
        initialMetrics,
        'user_123',
        now,
        now
      );
      expect(expiredCampaign.isExpired()).toBe(true);
    });
  });

  describe('Metrics Tracking', () => {
    it('should add metrics to campaign', () => {
      campaign.addMetrics({
        sent: 500,
        opened: 100,
        clicked: 25,
        converted: 5,
        revenue: 1000,
      });

      expect(campaign.metrics.sent).toBe(1500);
      expect(campaign.metrics.opened).toBe(350);
      expect(campaign.metrics.clicked).toBe(100);
      expect(campaign.metrics.converted).toBe(25);
      expect(campaign.metrics.revenue).toBe(6000);
    });

    it('should calculate open rate', () => {
      const openRate = campaign.getOpenRate();
      expect(openRate).toBe(25); // 250/1000 = 25%
    });

    it('should calculate click rate', () => {
      const clickRate = campaign.getClickRate();
      expect(clickRate).toBe(7.5); // 75/1000 = 7.5%
    });

    it('should calculate conversion rate', () => {
      const conversionRate = campaign.getConversionRate();
      expect(conversionRate).toBe(2); // 20/1000 = 2%
    });

    it('should return 0 rates when nothing sent', () => {
      const newCampaign = new Campaign(
        'camp_003',
        'No Activity',
        'EMAIL_BLAST',
        'DRAFT',
        'Test',
        {},
        startDate,
        endDate,
        1000,
        0,
        { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 },
        'user_123',
        now,
        now
      );
      expect(newCampaign.getOpenRate()).toBe(0);
      expect(newCampaign.getClickRate()).toBe(0);
      expect(newCampaign.getConversionRate()).toBe(0);
    });
  });

  describe('Budget Management', () => {
    it('should calculate ROI', () => {
      const roi = campaign.getROI();
      expect(roi).toBe(100); // 5000/5000 = 100%
    });

    it('should return 0 ROI without budget', () => {
      const noBudgetCampaign = new Campaign(
        'camp_004',
        'No Budget',
        'NEWSLETTER',
        'DRAFT',
        'Test',
        {},
        startDate,
        endDate,
        null,
        0,
        initialMetrics,
        'user_123',
        now,
        now
      );
      expect(noBudgetCampaign.getROI()).toBe(0);
    });

    it('should get remaining budget', () => {
      const remainingBudget = campaign.getRemainingBudget();
      expect(remainingBudget).toBe(5000);
    });

    it('should identify budget exhausted', () => {
      const budgetCampaign = new Campaign(
        'camp_005',
        'Low Budget',
        'EMAIL_BLAST',
        'ACTIVE',
        'Test',
        {},
        startDate,
        endDate,
        1000,
        1000,
        initialMetrics,
        'user_123',
        now,
        now
      );
      expect(budgetCampaign.isBudgetExhausted()).toBe(true);
    });

    it('should identify budget not exhausted', () => {
      expect(campaign.isBudgetExhausted()).toBe(false);
    });
  });
});
