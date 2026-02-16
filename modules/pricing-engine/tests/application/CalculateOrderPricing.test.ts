import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CalculateOrderPricing, OrderItem } from '../../src/application/use-cases/CalculateOrderPricing';
import {
  IPriceRepository,
  ProductPrice,
  PromotionRecord,
  VolumeDiscountRule,
} from '../../src/application/ports/IPriceRepository';
import { ITierRepository, CustomerTierRecord } from '../../src/application/ports/ITierRepository';
import { ProductNotFoundError, PricingError } from '../../src/application/errors/pricing.errors';

const makeProductPrice = (productId: number, price: number): ProductPrice => ({
  productId,
  price,
  currency: 'RON',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
});

const makePromotion = (
  productId: number,
  overrides: Partial<PromotionRecord> = {}
): PromotionRecord => ({
  id: 1,
  productId,
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

const makeVolumeRule = (
  productId: number,
  overrides: Partial<VolumeDiscountRule> = {}
): VolumeDiscountRule => ({
  id: 1,
  productId,
  minQuantity: 10,
  discountPercentage: 0.05,
  ...overrides,
});

const makeCustomerTier = (
  overrides: Partial<CustomerTierRecord> = {}
): CustomerTierRecord => ({
  customerId: 123,
  level: 'SILVER',
  discountPercentage: 0.1,
  name: 'Silver',
  assignedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('CalculateOrderPricing Use Case', () => {
  let useCase: CalculateOrderPricing;
  let mockPriceRepository: jest.Mocked<IPriceRepository>;
  let mockTierRepository: jest.Mocked<ITierRepository>;

  beforeEach(() => {
    mockPriceRepository = {
      getProductPrice: jest.fn(),
      getProductPricesByIds: jest.fn(),
      getActivePromotionsForProduct: jest.fn(),
      getVolumeDiscountRuleForQuantity: jest.fn(),
    } as unknown as jest.Mocked<IPriceRepository>;

    mockTierRepository = {
      getCustomerTier: jest.fn(),
    } as unknown as jest.Mocked<ITierRepository>;

    useCase = new CalculateOrderPricing(mockPriceRepository, mockTierRepository);
  });

  it('should calculate order total with single product', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 5 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.subtotal).toBe(500); // 5 * 100
    expect(result.taxAmount).toBeCloseTo(95, 0); // 500 * 0.21
    expect(result.grandTotal).toBeCloseTo(595, 0);
  });

  it('should calculate order with multiple products', async () => {
    const items: OrderItem[] = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 3 },
    ];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
      makeProductPrice(2, 50),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.subtotal).toBe(350); // (2*100) + (3*50)
    expect(result.lineItems).toHaveLength(2);
  });

  it('should apply customer tier discount', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 10 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(makeCustomerTier());

    const result = await useCase.execute(items, 123);

    expect(result.tierDiscount).toBe(100); // 100 * 0.1 * 10
    expect(result.totalDiscount).toBe(100);
  });

  it('should throw ProductNotFoundError when product not found', async () => {
    const items: OrderItem[] = [{ productId: 999, quantity: 1 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([]);

    await expect(useCase.execute(items)).rejects.toThrow(ProductNotFoundError);
  });

  it('should throw PricingError when items array is empty', async () => {
    const items: OrderItem[] = [];

    await expect(useCase.execute(items)).rejects.toThrow(PricingError);
  });

  it('should apply promotional discount', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 5 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotion(1),
    ]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.promotionalDiscount).toBe(100); // (100-80)*5
    expect(result.subtotal).toBe(500);
  });

  it('should apply volume discount when quantity threshold is met', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 20 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValueOnce({
      ...makeVolumeRule(1),
    });
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValueOnce(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.volumeDiscount).toBeGreaterThan(0);
  });

  it('should combine multiple discount types', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 15 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotion(1, { promotionalPrice: 90 }),
    ]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValueOnce({
      ...makeVolumeRule(1),
    });
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValueOnce(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(
      makeCustomerTier({
        level: 'GOLD',
        discountPercentage: 0.15,
        name: 'Gold',
      })
    );

    const result = await useCase.execute(items, 123);

    expect(result.tierDiscount).toBeGreaterThan(0);
    expect(result.promotionalDiscount).toBeGreaterThan(0);
    expect(result.totalDiscount).toBe(
      result.tierDiscount + result.promotionalDiscount + result.volumeDiscount
    );
  });

  it('should return correct line item structure', async () => {
    const items: OrderItem[] = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 3 },
    ];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
      makeProductPrice(2, 50),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toEqual(
      expect.objectContaining({
        productId: 1,
        quantity: 2,
        basePrice: 100,
        currency: 'RON',
      })
    );
  });

  it('should handle duplicate products in order', async () => {
    const items: OrderItem[] = [
      { productId: 1, quantity: 5 },
      { productId: 1, quantity: 3 },
    ];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.lineItems).toHaveLength(2);
    expect(result.subtotal).toBe(800); // (5*100) + (3*100)
  });

  it('should calculate correct tax amount', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 1 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.taxRate).toBe(0.21);
    expect(result.taxAmount).toBeCloseTo(100 * 0.21, 0);
  });

  it('should return currency in result', async () => {
    const items: OrderItem[] = [{ productId: 1, quantity: 1 }];

    mockPriceRepository.getProductPricesByIds.mockResolvedValue([
      makeProductPrice(1, 100),
    ]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getVolumeDiscountRuleForQuantity.mockResolvedValue(null);
    mockTierRepository.getCustomerTier.mockResolvedValue(null);

    const result = await useCase.execute(items);

    expect(result.currency).toBe('RON');
  });
});
