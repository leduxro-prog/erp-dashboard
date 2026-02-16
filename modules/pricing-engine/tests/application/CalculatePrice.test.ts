import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CalculatePrice } from '../../src/application/use-cases/CalculatePrice';
import {
  IPriceRepository,
  ProductPrice,
  PromotionRecord,
  VolumeDiscountRule,
} from '../../src/application/ports/IPriceRepository';
import { ITierRepository, CustomerTierRecord } from '../../src/application/ports/ITierRepository';
import { ProductNotFoundError } from '../../src/application/errors/pricing.errors';

const makeProductPrice = (price: number, productId: number = 1): ProductPrice => ({
  productId,
  price,
  currency: 'RON',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
});

const makePromotion = (overrides: Partial<PromotionRecord> = {}): PromotionRecord => ({
  id: 1,
  productId: 1,
  promotionalPrice: 80,
  originalPrice: 100,
  validFrom: new Date('2099-01-01T00:00:00.000Z'),
  validUntil: new Date('2099-01-31T00:00:00.000Z'),
  reason: 'Sale',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const makeVolumeRule = (overrides: Partial<VolumeDiscountRule> = {}): VolumeDiscountRule => ({
  id: 1,
  productId: 1,
  minQuantity: 10,
  discountPercentage: 0.05,
  ...overrides,
});

const makeCustomerTier = (overrides: Partial<CustomerTierRecord> = {}): CustomerTierRecord => ({
  customerId: 123,
  level: 'SILVER',
  discountPercentage: 0.05,
  name: 'Silver',
  assignedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('CalculatePrice Use Case', () => {
  let useCase: CalculatePrice;
  let mockPriceRepository: jest.Mocked<IPriceRepository>;
  let mockTierRepository: jest.Mocked<ITierRepository>;

  beforeEach(() => {
    mockPriceRepository = {
      getProductPrice: jest.fn(),
      getActivePromotionsForProduct: jest.fn(),
      getVolumeDiscountRuleForQuantity: jest.fn(),
    } as unknown as jest.Mocked<IPriceRepository>;

    mockTierRepository = {
      getCustomerTier: jest.fn(),
    } as unknown as jest.Mocked<ITierRepository>;

    useCase = new CalculatePrice(mockPriceRepository, mockTierRepository);
  });

  it('should return correct calculation for known product without tier', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(1);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tierDiscount).toBe(0);
    expect(result.breakdownDetails.appliedPromotion).toBeUndefined();
    expect(result.finalPrice).toBe(100);
  });

  it('should apply customer tier discount when customerId provided', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockTierRepository.getCustomerTier.mockResolvedValue(makeCustomerTier());

    const result = await useCase.execute(1, 123);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tierDiscountPercentage).toBe(0.05);
    expect(result.finalPrice).toBeCloseTo(95, 0); // 100 * (1 - 0.05)
  });

  it('should throw ProductNotFoundError for missing product', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(ProductNotFoundError);
  });

  it('should apply active promotion when available', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotion(),
    ]);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(1);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.promotionalPrice).toBe(80);
    expect(result.breakdownDetails.appliedPromotion).toBeDefined();
  });

  it('should apply promotion and tier discount together', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotion(),
    ]);
    mockTierRepository.getCustomerTier.mockResolvedValue(
      makeCustomerTier({
        level: 'GOLD',
        discountPercentage: 0.1,
        name: 'Gold',
      })
    );

    const result = await useCase.execute(1, 123);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tierDiscountPercentage).toBe(0.10);
    expect(result.promotionalPrice).toBe(80);
    expect(result.breakdownDetails.appliedPromotion).toBeDefined();
  });

  it('should return zero tier discount when customer not found', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(1, 999);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tierDiscountPercentage).toBe(0);
    expect(result.finalPrice).toBe(100);
  });

  it('should apply volume discount for quantity', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(
      makeVolumeRule({
        maxQuantity: 50,
      })
    );
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(1, undefined, 20);

    expect(result.productId).toBe(1);
    expect(result.quantity).toBe(20);
    expect(result.volumeDiscountPercentage).toBe(0.05);
  });

  it('should calculate final price correctly with all discounts', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotion({
        promotionalPrice: 90,
      }),
    ]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(
      makeVolumeRule({
        discountPercentage: 0.1,
      })
    );
    mockTierRepository.getCustomerTier.mockResolvedValue(
      makeCustomerTier({
        level: 'PLATINUM',
        discountPercentage: 0.15,
        name: 'Platinum',
      })
    );

    const result = await useCase.execute(1, 123, 20);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tierDiscountPercentage).toBe(0.15);
    expect(result.volumeDiscountPercentage).toBe(0.10);
    expect(result.finalPrice).toBeGreaterThan(0);
    expect(result.finalPrice).toBeLessThan(100);
  });
});
