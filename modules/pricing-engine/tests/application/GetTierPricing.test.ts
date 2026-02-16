import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetTierPricing } from '../../src/application/use-cases/GetTierPricing';
import { IPriceRepository, ProductPrice } from '../../src/application/ports/IPriceRepository';
import { ProductNotFoundError } from '../../src/application/errors/pricing.errors';

const makeProductPrice = (price: number, productId: number = 1): ProductPrice => ({
  productId,
  price,
  currency: 'RON',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
});

describe('GetTierPricing Use Case', () => {
  let useCase: GetTierPricing;
  let mockPriceRepository: jest.Mocked<IPriceRepository>;

  beforeEach(() => {
    mockPriceRepository = {
      getProductPrice: jest.fn(),
      getActivePromotionsForProduct: jest.fn(),
      getVolumeDiscountRuleForQuantity: jest.fn(),
    } as unknown as jest.Mocked<IPriceRepository>;

    useCase = new GetTierPricing(mockPriceRepository);
  });

  it('should return tier pricing for valid product', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    expect(result.productId).toBe(1);
    expect(result.basePrice).toBe(100);
    expect(result.tiers).toHaveLength(4);
    expect(result.currency).toBe('RON');
  });

  it('should calculate correct prices at each tier level', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    // Bronze: 5% discount = 95
    expect(result.tiers[0].name).toBe('Bronze');
    expect(result.tiers[0].discountPercentage).toBe(0.05);
    expect(result.tiers[0].price).toBeCloseTo(95, 0);

    // Silver: 10% discount = 90
    expect(result.tiers[1].name).toBe('Silver');
    expect(result.tiers[1].discountPercentage).toBe(0.1);
    expect(result.tiers[1].price).toBeCloseTo(90, 0);

    // Gold: 15% discount = 85
    expect(result.tiers[2].name).toBe('Gold');
    expect(result.tiers[2].discountPercentage).toBe(0.15);
    expect(result.tiers[2].price).toBeCloseTo(85, 0);

    // Platinum: 20% discount = 80
    expect(result.tiers[3].name).toBe('Platinum');
    expect(result.tiers[3].discountPercentage).toBe(0.2);
    expect(result.tiers[3].price).toBeCloseTo(80, 0);
  });

  it('should throw ProductNotFoundError when product not found', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(ProductNotFoundError);
  });

  it('should handle high base prices correctly', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(5000));

    const result = await useCase.execute(1);

    expect(result.basePrice).toBe(5000);
    expect(result.tiers[0].price).toBeCloseTo(4750, 0); // 5% discount
    expect(result.tiers[3].price).toBeCloseTo(4000, 0); // 20% discount
  });

  it('should handle small base prices correctly', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(10));

    const result = await useCase.execute(1);

    expect(result.basePrice).toBe(10);
    expect(result.tiers[0].price).toBeCloseTo(9.5, 1); // 5% discount
    expect(result.tiers[3].price).toBeCloseTo(8, 1); // 20% discount
  });

  it('should include level identifier for each tier', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    expect(result.tiers[0].level).toBeDefined();
    expect(result.tiers[1].level).toBeDefined();
    expect(result.tiers[2].level).toBeDefined();
    expect(result.tiers[3].level).toBeDefined();
  });

  it('should maintain tier order from Bronze to Platinum', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    expect(result.tiers[0].name).toBe('Bronze');
    expect(result.tiers[1].name).toBe('Silver');
    expect(result.tiers[2].name).toBe('Gold');
    expect(result.tiers[3].name).toBe('Platinum');
  });

  it('should calculate prices in descending order from base', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    expect(result.tiers[0].price).toBeGreaterThan(result.tiers[1].price);
    expect(result.tiers[1].price).toBeGreaterThan(result.tiers[2].price);
    expect(result.tiers[2].price).toBeGreaterThan(result.tiers[3].price);
  });

  it('should return correct discount percentages', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100));

    const result = await useCase.execute(1);

    const discounts = result.tiers.map(t => t.discountPercentage);
    expect(discounts).toEqual([0.05, 0.1, 0.15, 0.2]);
  });

  it('should call repository with correct product ID', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(100, 42));

    await useCase.execute(42);

    expect(mockPriceRepository.getProductPrice).toHaveBeenCalledWith(42);
    expect(mockPriceRepository.getProductPrice).toHaveBeenCalledTimes(1);
  });

  it('should handle decimal prices correctly', async () => {
    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(99.99));

    const result = await useCase.execute(1);

    expect(result.basePrice).toBe(99.99);
    expect(result.tiers[0].price).toBeCloseTo(99.99 * 0.95, 2);
  });
});
