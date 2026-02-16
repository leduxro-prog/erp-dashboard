import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ManageTiers, TierLevel } from '../../src/application/use-cases/ManageTiers';
import { ITierRepository, CustomerTierRecord } from '../../src/application/ports/ITierRepository';
import { CustomerTierNotFoundError, PricingError } from '../../src/application/errors/pricing.errors';

const makeCustomerTierRecord = (
  overrides: Partial<CustomerTierRecord> = {}
): CustomerTierRecord => ({
  customerId: 123,
  level: TierLevel.SILVER,
  discountPercentage: 0.1,
  name: 'Silver',
  assignedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ManageTiers Use Case', () => {
  let useCase: ManageTiers;
  let mockTierRepository: jest.Mocked<ITierRepository>;

  beforeEach(() => {
    mockTierRepository = {
      getCustomerTier: jest.fn(),
      setCustomerTier: jest.fn(),
    } as unknown as jest.Mocked<ITierRepository>;

    useCase = new ManageTiers(mockTierRepository);
  });

  describe('getCustomerTier', () => {
    it('should return customer tier when customer exists', async () => {
      mockTierRepository.getCustomerTier.mockResolvedValue(
        makeCustomerTierRecord()
      );

      const result = await useCase.getCustomerTier(123);

      expect(result.customerId).toBe(123);
      expect(result.level).toBe(TierLevel.SILVER);
      expect(result.name).toBe('Silver');
      expect(result.discountPercentage).toBe(0.1);
    });

    it('should throw CustomerTierNotFoundError when customer has no tier', async () => {
      mockTierRepository.getCustomerTier.mockResolvedValue(null);

      await expect(useCase.getCustomerTier(999)).rejects.toThrow(
        CustomerTierNotFoundError
      );
    });

    it('should return correct tier name for each level', async () => {
      const tierLevels = [
        { level: TierLevel.BRONZE, name: 'Bronze', discount: 0.05 },
        { level: TierLevel.SILVER, name: 'Silver', discount: 0.1 },
        { level: TierLevel.GOLD, name: 'Gold', discount: 0.15 },
        { level: TierLevel.PLATINUM, name: 'Platinum', discount: 0.2 },
      ];

      for (const tier of tierLevels) {
        mockTierRepository.getCustomerTier.mockResolvedValue(
          makeCustomerTierRecord({
            level: tier.level,
            discountPercentage: tier.discount,
            name: tier.name,
          })
        );

        const result = await useCase.getCustomerTier(123);

        expect(result.name).toBe(tier.name);
      }
    });
  });

  describe('setCustomerTier', () => {
    it('should set customer tier with valid inputs', async () => {
      await useCase.setCustomerTier(123, TierLevel.GOLD, 'Promotion');

      expect(mockTierRepository.setCustomerTier).toHaveBeenCalledWith(
        123,
        TierLevel.GOLD,
        0.15,
        'Promotion'
      );
    });

    it('should throw PricingError for invalid tier level', async () => {
      await expect(
        useCase.setCustomerTier(123, 'INVALID' as TierLevel, 'Invalid')
      ).rejects.toThrow(PricingError);
    });

    it('should throw PricingError when reason is empty', async () => {
      await expect(
        useCase.setCustomerTier(123, TierLevel.SILVER, '')
      ).rejects.toThrow(PricingError);
    });

    it('should throw PricingError when reason is whitespace only', async () => {
      await expect(
        useCase.setCustomerTier(123, TierLevel.SILVER, '   ')
      ).rejects.toThrow(PricingError);
    });

    it('should use correct discount for Bronze tier', async () => {
      await useCase.setCustomerTier(123, TierLevel.BRONZE, 'New Customer');

      expect(mockTierRepository.setCustomerTier).toHaveBeenCalledWith(
        123,
        TierLevel.BRONZE,
        0.05,
        'New Customer'
      );
    });

    it('should use correct discount for Silver tier', async () => {
      await useCase.setCustomerTier(123, TierLevel.SILVER, 'Silver Member');

      expect(mockTierRepository.setCustomerTier).toHaveBeenCalledWith(
        123,
        TierLevel.SILVER,
        0.1,
        'Silver Member'
      );
    });

    it('should use correct discount for Gold tier', async () => {
      await useCase.setCustomerTier(123, TierLevel.GOLD, 'Gold Member');

      expect(mockTierRepository.setCustomerTier).toHaveBeenCalledWith(
        123,
        TierLevel.GOLD,
        0.15,
        'Gold Member'
      );
    });

    it('should use correct discount for Platinum tier', async () => {
      await useCase.setCustomerTier(123, TierLevel.PLATINUM, 'Platinum Member');

      expect(mockTierRepository.setCustomerTier).toHaveBeenCalledWith(
        123,
        TierLevel.PLATINUM,
        0.2,
        'Platinum Member'
      );
    });
  });

  describe('getAllTiers', () => {
    it('should return all available tiers', async () => {
      const tiers = await useCase.getAllTiers();

      expect(tiers).toHaveLength(4);
      expect(tiers.map(t => t.level)).toEqual([
        TierLevel.BRONZE,
        TierLevel.SILVER,
        TierLevel.GOLD,
        TierLevel.PLATINUM,
      ]);
    });

    it('should include correct names for all tiers', async () => {
      const tiers = await useCase.getAllTiers();

      expect(tiers[0]).toEqual({
        level: TierLevel.BRONZE,
        name: 'Bronze',
        discountPercentage: 0.05,
      });
      expect(tiers[1]).toEqual({
        level: TierLevel.SILVER,
        name: 'Silver',
        discountPercentage: 0.1,
      });
      expect(tiers[2]).toEqual({
        level: TierLevel.GOLD,
        name: 'Gold',
        discountPercentage: 0.15,
      });
      expect(tiers[3]).toEqual({
        level: TierLevel.PLATINUM,
        name: 'Platinum',
        discountPercentage: 0.2,
      });
    });

    it('should include correct discounts for all tiers', async () => {
      const tiers = await useCase.getAllTiers();

      const discounts = tiers.map(t => t.discountPercentage);
      expect(discounts).toEqual([0.05, 0.1, 0.15, 0.2]);
    });

    it('should return tiers in correct order', async () => {
      const tiers = await useCase.getAllTiers();

      const names = tiers.map(t => t.name);
      expect(names).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum']);
    });
  });

  describe('tier discount mapping', () => {
    it('should maintain consistent discount percentages', async () => {
      const discountMap = {
        [TierLevel.BRONZE]: 0.05,
        [TierLevel.SILVER]: 0.1,
        [TierLevel.GOLD]: 0.15,
        [TierLevel.PLATINUM]: 0.2,
      };

      for (const [level, expectedDiscount] of Object.entries(discountMap)) {
        await useCase.setCustomerTier(123, level as TierLevel, 'Test');

        const call = mockTierRepository.setCustomerTier.mock.calls.at(-1);
        expect(call?.[2]).toBe(expectedDiscount);
      }
    });
  });

  describe('error messages', () => {
    it('should include valid tier levels in error message', async () => {
      try {
        await useCase.setCustomerTier(123, 'INVALID' as TierLevel, 'reason');
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('BRONZE');
        expect(error.message).toContain('SILVER');
        expect(error.message).toContain('GOLD');
        expect(error.message).toContain('PLATINUM');
      }
    });

    it('should include customer ID in CustomerTierNotFoundError', async () => {
      mockTierRepository.getCustomerTier.mockResolvedValue(null);

      try {
        await useCase.getCustomerTier(999);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('999');
      }
    });
  });
});
