/**
 * CreateCampaign Use Case Tests
 * Tests campaign creation with different types and date validation
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateCampaign, CreateCampaignInput } from '../../src/application/use-cases/CreateCampaign';
import {
  InvalidCampaignDateRangeError,
  InvalidAudienceFilterError,
} from '../../src/domain/errors/marketing.errors';

describe('CreateCampaign Use Case', () => {
  let useCase: CreateCampaign;
  let mockCampaignRepository: any;
  let mockAudienceSegmentationService: any;

  beforeEach(() => {
    mockCampaignRepository = {
      save: jest.fn(),
    };

    mockAudienceSegmentationService = {
      validateFilter: jest.fn(),
    };

    useCase = new CreateCampaign(mockCampaignRepository, mockAudienceSegmentationService);
  });

  describe('Happy Path - Campaign Creation', () => {
    it('should create EMAIL campaign successfully', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Q1 Email Campaign',
        type: 'EMAIL_BLAST',
        description: 'Spring promotional email campaign',
        targetAudience: { minTotalSpent: 100, tiers: ['GOLD'] },
        startDate: tomorrow,
        endDate: nextWeek,
        budget: 5000,
        createdBy: 'user-001',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-001',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
      expect(result.campaign.name).toBe('Q1 Email Campaign');
      expect(mockCampaignRepository.save).toHaveBeenCalled();
    });

    it('should create SMS campaign successfully', async () => {
      const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const inOneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const input: CreateCampaignInput = {
        name: 'SMS Flash Sale',
        type: 'FLASH_SALE',
        description: 'Urgent SMS promotion',
        targetAudience: { tags: ['region:RO'] },
        startDate: inTwoHours,
        endDate: inOneWeek,
        budget: 2000,
        createdBy: 'user-002',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-002',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.name).toBe('SMS Flash Sale');
    });

    it('should create SOCIAL campaign successfully', async () => {
      const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const input: CreateCampaignInput = {
        name: 'Instagram Product Launch',
        type: 'PRODUCT_LAUNCH',
        description: 'Social media campaign for new product',
        targetAudience: { purchasedCategories: ['electronics'] },
        startDate: inThreeHours,
        endDate: inTenDays,
        budget: 8000,
        createdBy: 'user-003',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-003',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.name).toBe('Instagram Product Launch');
    });

    it('should create campaign without budget', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);

      const input: CreateCampaignInput = {
        name: 'Organic Campaign',
        type: 'EMAIL_BLAST',
        description: 'Non-paid campaign',
        targetAudience: {},
        startDate: tomorrow,
        endDate: inTwoDays,
        createdBy: 'user-004',
        // No budget
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-004',
        ...input,
        budget: null,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
    });

    it('should set DRAFT status for new campaigns', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Draft Campaign',
        type: 'EMAIL_BLAST',
        description: 'Campaign in draft',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        createdBy: 'user-005',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-005',
        ...input,
        status: 'DRAFT',
      });

      const result = await useCase.execute(input);

      const savedCall = mockCampaignRepository.save.mock.calls[0][0];
      expect(savedCall.status).toBe('DRAFT');
    });
  });

  describe('Date Validation', () => {
    it('should reject start date in the past', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: CreateCampaignInput = {
        name: 'Invalid Campaign',
        type: 'EMAIL_BLAST',
        description: 'Past date campaign',
        targetAudience: {},
        startDate: yesterday,
        endDate: tomorrow,
        createdBy: 'user-006',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});

      await expect(useCase.execute(input)).rejects.toThrow(InvalidCampaignDateRangeError);
      expect(mockCampaignRepository.save).not.toHaveBeenCalled();
    });

    it('should reject end date before start date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const today = new Date();

      const input: CreateCampaignInput = {
        name: 'Invalid Range',
        type: 'EMAIL_BLAST',
        description: 'End before start',
        targetAudience: {},
        startDate: tomorrow,
        endDate: today,
        createdBy: 'user-007',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});

      await expect(useCase.execute(input)).rejects.toThrow(InvalidCampaignDateRangeError);
    });

    it('should reject campaign duration less than 1 hour', async () => {
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutes
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);

      const input: CreateCampaignInput = {
        name: 'Too Short Campaign',
        type: 'FLASH_SALE',
        description: 'Less than 1 hour',
        targetAudience: {},
        startDate: start,
        endDate: end,
        createdBy: 'user-008',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});

      await expect(useCase.execute(input)).rejects.toThrow(InvalidCampaignDateRangeError);
    });

    it('should allow campaign with exactly 1 hour duration', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const oneHourLater = new Date(tomorrow.getTime() + 60 * 60 * 1000);

      const input: CreateCampaignInput = {
        name: 'One Hour Campaign',
        type: 'EMAIL_BLAST',
        description: 'Exactly 1 hour',
        targetAudience: {},
        startDate: tomorrow,
        endDate: oneHourLater,
        createdBy: 'user-009',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-009',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
    });
  });

  describe('Audience Validation', () => {
    it('should reject invalid audience filter', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Invalid Audience',
        type: 'EMAIL_BLAST',
        description: 'Bad audience filter',
        targetAudience: { minTotalSpent: -100 }, // Invalid
        startDate: tomorrow,
        endDate: nextWeek,
        createdBy: 'user-010',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {
        throw new Error('Invalid spending range');
      });

      await expect(useCase.execute(input)).rejects.toThrow(InvalidAudienceFilterError);
    });

    it('should accept complex audience filters', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Complex Audience',
        type: 'EMAIL_BLAST',
        description: 'Complex filter',
        targetAudience: {
          minTotalSpent: 500,
          minPurchaseHistoryDays: 90,
          tiers: ['GOLD', 'PLATINUM'],
          tags: ['tech', 'business'],
          purchasedCategories: ['electronics', 'services'],
        },
        startDate: tomorrow,
        endDate: nextWeek,
        createdBy: 'user-011',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-011',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
    });
  });

  describe('Budget Validation', () => {
    it('should reject zero budget', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Zero Budget Campaign',
        type: 'EMAIL_BLAST',
        description: 'Zero budget',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        budget: 0,
        createdBy: 'user-012',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});

      await expect(useCase.execute(input)).rejects.toThrow();
    });

    it('should reject negative budget', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Negative Budget',
        type: 'EMAIL_BLAST',
        description: 'Negative budget',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        budget: -5000,
        createdBy: 'user-013',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});

      await expect(useCase.execute(input)).rejects.toThrow();
    });

    it('should accept large budget amounts', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Large Budget Campaign',
        type: 'EMAIL_BLAST',
        description: 'Enterprise campaign',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        budget: 1000000,
        createdBy: 'user-014',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-014',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long campaign duration', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      const input: CreateCampaignInput = {
        name: 'Year-Long Campaign',
        type: 'EMAIL_BLAST',
        description: 'Annual campaign',
        targetAudience: {},
        startDate: tomorrow,
        endDate: oneYearLater,
        budget: 100000,
        createdBy: 'user-015',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-015',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.id).toBeDefined();
    });

    it('should handle special characters in campaign name', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Q1 2025 - "New Year" Sale & Promo',
        type: 'EMAIL_BLAST',
        description: 'Special characters & symbols',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        budget: 5000,
        createdBy: 'user-016',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-016',
        ...input,
      });

      const result = await useCase.execute(input);

      expect(result.campaign.name).toBe('Q1 2025 - "New Year" Sale & Promo');
    });

    it('should initialize metrics to zero', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const input: CreateCampaignInput = {
        name: 'Metrics Test',
        type: 'EMAIL_BLAST',
        description: 'Test metrics',
        targetAudience: {},
        startDate: tomorrow,
        endDate: nextWeek,
        createdBy: 'user-017',
      };

      mockAudienceSegmentationService.validateFilter.mockImplementation(() => {});
      mockCampaignRepository.save.mockResolvedValue({
        id: 'camp-017',
        ...input,
        metrics: { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 },
      });

      const result = await useCase.execute(input);

      const savedCall = mockCampaignRepository.save.mock.calls[0][0];
      expect(savedCall.metrics.sent).toBe(0);
      expect(savedCall.metrics.opened).toBe(0);
      expect(savedCall.metrics.clicked).toBe(0);
    });
  });
});
