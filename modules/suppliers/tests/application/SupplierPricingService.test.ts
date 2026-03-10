import { describe, expect, it, jest } from '@jest/globals';

import { ISupplierRepository, SupplierPricingRule } from '../../src/domain';
import {
  DEFAULT_SUPPLIER_MARKUP_PERCENTAGE,
  SupplierPricingService,
} from '../../src/application/services/SupplierPricingService';

describe('SupplierPricingService', () => {
  const createRepository = () =>
    ({
      getSupplierPricingRule: jest
        .fn<ISupplierRepository['getSupplierPricingRule']>()
        .mockImplementation(async () => null),
    }) as unknown as jest.Mocked<ISupplierRepository>;

  const buildRule = (overrides?: Partial<SupplierPricingRule>): SupplierPricingRule => ({
    supplierCode: 'innpro',
    categoryKey: 'audio',
    markupPercent: 35,
    active: true,
    createdAt: new Date('2026-03-10T10:00:00.000Z'),
    updatedAt: new Date('2026-03-10T10:00:00.000Z'),
    ...overrides,
  });

  it('applies active supplier category rule when available', async () => {
    const repository = createRepository();
    repository.getSupplierPricingRule.mockImplementationOnce(async () => buildRule());
    const service = new SupplierPricingService(repository);

    const result = await service.resolveMarkup('innpro', '  Audio  ');

    expect(repository.getSupplierPricingRule).toHaveBeenCalledWith('innpro', 'audio');
    expect(result).toEqual({
      markupPercentage: 35,
      source: 'category_rule',
      categoryKey: 'audio',
    });
  });

  it('falls back to 60% when rule is missing or inactive', async () => {
    const repository = createRepository();
    repository.getSupplierPricingRule.mockImplementationOnce(
      async () => buildRule({ active: false, markupPercent: 12 }),
    );
    const service = new SupplierPricingService(repository);

    const result = await service.resolveMarkup('innpro', 'audio');

    expect(result).toEqual({
      markupPercentage: DEFAULT_SUPPLIER_MARKUP_PERCENTAGE,
      source: 'fallback_default',
      categoryKey: 'audio',
    });
  });

  it('falls back to 60% without repository query for missing category', async () => {
    const repository = createRepository();
    const service = new SupplierPricingService(repository);

    const result = await service.resolveMarkup('innpro', '   ');

    expect(repository.getSupplierPricingRule).not.toHaveBeenCalled();
    expect(result).toEqual({
      markupPercentage: DEFAULT_SUPPLIER_MARKUP_PERCENTAGE,
      source: 'fallback_default',
      categoryKey: null,
    });
  });

  it('calculates selling price from base price and markup', () => {
    const repository = createRepository();
    const service = new SupplierPricingService(repository);

    expect(service.applyMarkup(100, 60)).toBe(160);
    expect(service.applyMarkup(99.99, 17.5)).toBe(117.49);
  });
});
