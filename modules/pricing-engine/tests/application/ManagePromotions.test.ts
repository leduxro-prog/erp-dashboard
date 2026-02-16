import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ManagePromotions } from '../../src/application/use-cases/ManagePromotions';
import {
  IPriceRepository,
  ProductPrice,
  PromotionRecord,
} from '../../src/application/ports/IPriceRepository';
import { CreatePromotionDTO } from '../../src/application/dtos/pricing.dtos';
import {
  ProductNotFoundError,
  InvalidPromotionError,
  PromotionDateError,
} from '../../src/application/errors/pricing.errors';

const makeProductPrice = (
  productId: number,
  price: number = 100
): ProductPrice => ({
  productId,
  price,
  currency: 'RON',
  lastUpdated: new Date('2026-01-01T00:00:00.000Z'),
});

const makePromotionRecord = (
  overrides: Partial<PromotionRecord> = {}
): PromotionRecord => ({
  id: 1,
  productId: 1,
  promotionalPrice: 80,
  originalPrice: 100,
  validFrom: new Date('2099-02-08T00:00:00.000Z'),
  validUntil: new Date('2099-02-28T00:00:00.000Z'),
  reason: 'Sale',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ManagePromotions Use Case', () => {
  let useCase: ManagePromotions;
  let mockPriceRepository: jest.Mocked<IPriceRepository>;

  beforeEach(() => {
    mockPriceRepository = {
      getProductPrice: jest.fn(),
      createPromotion: jest.fn(),
      deactivatePromotion: jest.fn(),
      getActivePromotionsForProduct: jest.fn(),
      getAllActivePromotions: jest.fn(),
      expirePromotionsBefore: jest.fn(),
    } as unknown as jest.Mocked<IPriceRepository>;

    useCase = new ManagePromotions(mockPriceRepository);
  });

  it('should create valid promotion', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Winter Sale',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.createPromotion.mockResolvedValue(
      makePromotionRecord({
        validFrom: promotionData.validFrom,
        validUntil: promotionData.validUntil,
        reason: 'Winter Sale',
      })
    );

    const result = await useCase.createPromotion(promotionData);

    expect(result.id).toBe(1);
    expect(result.promotionalPrice).toBe(80);
    expect(result.originalPrice).toBe(100);
  });

  it('should throw ProductNotFoundError for non-existent product', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 999,
      promotionalPrice: 80,
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Winter Sale',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(null);

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      ProductNotFoundError
    );
  });

  it('should throw InvalidPromotionError if promotional price >= original price', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 100,
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Invalid Promo',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      InvalidPromotionError
    );
  });

  it('should throw InvalidPromotionError if promotional price <= 0', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 0,
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Invalid Price',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      InvalidPromotionError
    );
  });

  it('should throw PromotionDateError if validFrom >= validUntil', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: new Date('2099-02-28'),
      validUntil: new Date('2099-02-08'),
      reason: 'Invalid Dates',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      PromotionDateError
    );
  });

  it('should throw PromotionDateError if validUntil is in the past', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2024-01-02'),
      reason: 'Past Promotion',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      PromotionDateError
    );
  });

  it('should throw PromotionDateError if date overlaps with existing promotion', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Overlapping Promo',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotionRecord({
        promotionalPrice: 90,
        validFrom: new Date('2099-02-15'),
        validUntil: new Date('2099-03-15'),
        reason: 'Existing',
      }),
    ]);

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      PromotionDateError
    );
  });

  it('should deactivate promotion', async () => {
    await useCase.deactivatePromotion(1);

    expect(mockPriceRepository.deactivatePromotion).toHaveBeenCalledWith(1);
  });

  it('should get active promotions for product', async () => {
    const expectedPromotions = [makePromotionRecord()];

    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue(
      expectedPromotions
    );

    const result = await useCase.getActivePromotions(1);

    expect(result).toEqual(expectedPromotions);
    expect(mockPriceRepository.getActivePromotionsForProduct).toHaveBeenCalledWith(1);
  });

  it('should get all active promotions when no product ID provided', async () => {
    const expectedPromotions = [makePromotionRecord()];

    mockPriceRepository.getAllActivePromotions.mockResolvedValue(
      expectedPromotions
    );

    const result = await useCase.getActivePromotions();

    expect(result).toEqual(expectedPromotions);
    expect(mockPriceRepository.getAllActivePromotions).toHaveBeenCalled();
  });

  it('should expire overdue promotions', async () => {
    mockPriceRepository.expirePromotionsBefore.mockResolvedValue(3);

    const result = await useCase.expireOverduePromotions();

    expect(result).toBe(3);
    expect(mockPriceRepository.expirePromotionsBefore).toHaveBeenCalled();
  });

  it('should allow discount up to 90%', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 10, // 90% discount on 100
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Heavy Discount',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);
    mockPriceRepository.createPromotion.mockResolvedValue(
      makePromotionRecord({
        promotionalPrice: 10,
        validFrom: promotionData.validFrom,
        validUntil: promotionData.validUntil,
        reason: 'Heavy Discount',
      })
    );

    const result = await useCase.createPromotion(promotionData);

    expect(result.promotionalPrice).toBe(10);
  });

  it('should throw InvalidPromotionError if discount exceeds 90%', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 5, // 95% discount on 100
      validFrom: new Date('2099-02-08'),
      validUntil: new Date('2099-02-28'),
      reason: 'Too Much Discount',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([]);

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      InvalidPromotionError
    );
  });

  it('should handle non-overlapping date ranges', async () => {
    const promotionData: CreatePromotionDTO = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: new Date('2099-03-01'),
      validUntil: new Date('2099-03-31'),
      reason: 'March Sale',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));
    mockPriceRepository.getActivePromotionsForProduct.mockResolvedValue([
      makePromotionRecord({
        promotionalPrice: 90,
        validFrom: new Date('2099-02-01'),
        validUntil: new Date('2099-02-28'),
        reason: 'February Sale',
      }),
    ]);
    mockPriceRepository.createPromotion.mockResolvedValue(
      makePromotionRecord({
        id: 2,
        validFrom: promotionData.validFrom,
        validUntil: promotionData.validUntil,
        reason: 'March Sale',
      })
    );

    const result = await useCase.createPromotion(promotionData);

    expect(result.id).toBe(2);
  });

  it('should validate dates are Date instances', async () => {
    const promotionData: any = {
      productId: 1,
      promotionalPrice: 80,
      validFrom: 'not-a-date',
      validUntil: new Date('2099-02-28'),
      reason: 'Invalid Date Format',
    };

    mockPriceRepository.getProductPrice.mockResolvedValue(makeProductPrice(1, 100));

    await expect(useCase.createPromotion(promotionData)).rejects.toThrow(
      PromotionDateError
    );
  });
});
