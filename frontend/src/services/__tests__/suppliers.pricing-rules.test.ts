import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type ApiClientMock = {
  get: ReturnType<typeof jest.fn>;
  post: ReturnType<typeof jest.fn>;
  put: ReturnType<typeof jest.fn>;
  patch: ReturnType<typeof jest.fn>;
};

const apiClientMock: ApiClientMock = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
};

jest.mock('../api', () => ({
  apiClient: apiClientMock,
}));

import { suppliersService } from '../suppliers.service';

describe('suppliersService pricing rules', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    apiClientMock.post.mockReset();
    apiClientMock.put.mockReset();
    apiClientMock.patch.mockReset();
  });

  it('lists Innpro pricing rules', async () => {
    apiClientMock.get.mockResolvedValue({
      success: true,
      data: [
        {
          supplierCode: 'innpro',
          categoryKey: 'audio',
          markupPercent: 12,
          active: true,
          createdAt: '2026-03-10T10:00:00.000Z',
          updatedAt: '2026-03-10T10:00:00.000Z',
        },
      ],
    });

    const rules = await suppliersService.getSupplierPricingRules('innpro');

    expect(apiClientMock.get).toHaveBeenCalledWith('/pricing-rules/innpro');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.categoryKey).toBe('audio');
  });

  it('creates pricing rule', async () => {
    apiClientMock.post.mockResolvedValue({
      success: true,
      data: {
        supplierCode: 'innpro',
        categoryKey: 'gaming',
        markupPercent: 25,
        active: true,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
      },
    });

    const rule = await suppliersService.createSupplierPricingRule({
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 25,
      active: true,
    });

    expect(apiClientMock.post).toHaveBeenCalledWith('/pricing-rules', {
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 25,
      active: true,
    });
    expect(rule.categoryKey).toBe('gaming');
  });

  it('updates pricing rule by category key', async () => {
    apiClientMock.put.mockResolvedValue({
      success: true,
      data: {
        supplierCode: 'innpro',
        categoryKey: 'audio video',
        markupPercent: 30,
        active: true,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:10:00.000Z',
      },
    });

    const rule = await suppliersService.upsertSupplierPricingRuleByKey('innpro', 'audio video', {
      markupPercent: 30,
      active: true,
    });

    expect(apiClientMock.put).toHaveBeenCalledWith('/pricing-rules/innpro/audio%20video', {
      markupPercent: 30,
      active: true,
    });
    expect(rule.markupPercent).toBe(30);
  });

  it('toggles active status', async () => {
    apiClientMock.patch.mockResolvedValue({
      success: true,
      data: {
        supplierCode: 'innpro',
        categoryKey: 'audio',
        markupPercent: 12,
        active: false,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:20:00.000Z',
      },
    });

    const rule = await suppliersService.setSupplierPricingRuleActive('innpro', 'audio', false);

    expect(apiClientMock.patch).toHaveBeenCalledWith('/pricing-rules/innpro/audio/active', {
      active: false,
    });
    expect(rule.active).toBe(false);
  });
});
