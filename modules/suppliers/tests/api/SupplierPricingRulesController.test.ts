import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';

import { SupplierPricingRulesController } from '../../src/api/controllers/SupplierPricingRulesController';
import { SupplierPricingRule } from '../../src/domain';

type SupplierPricingRulesRepository = {
  listSupplierPricingRules: (supplierCode: string) => Promise<SupplierPricingRule[]>;
  getSupplierPricingRule: (
    supplierCode: string,
    categoryKey: string,
  ) => Promise<SupplierPricingRule | null>;
  upsertSupplierPricingRule: (input: {
    supplierCode: string;
    categoryKey: string;
    markupPercent: number;
    active?: boolean;
  }) => Promise<SupplierPricingRule>;
  updateSupplierPricingRuleActive: (
    supplierCode: string,
    categoryKey: string,
    active: boolean,
  ) => Promise<SupplierPricingRule | null>;
};

const createResponse = () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  json.mockReturnValue(response);
  return response;
};

describe('SupplierPricingRulesController', () => {
  let repository: jest.Mocked<SupplierPricingRulesRepository>;
  let controller: SupplierPricingRulesController;

  beforeEach(() => {
    repository = {
      listSupplierPricingRules: jest.fn(),
      getSupplierPricingRule: jest.fn(),
      upsertSupplierPricingRule: jest.fn(),
      updateSupplierPricingRuleActive: jest.fn(),
    } as unknown as jest.Mocked<SupplierPricingRulesRepository>;

    controller = new SupplierPricingRulesController(repository);
  });

  it('lists pricing rules by supplier code', async () => {
    repository.listSupplierPricingRules.mockResolvedValue([
      {
        supplierCode: 'innpro',
        categoryKey: 'audio',
        markupPercent: 15,
        active: true,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        updatedAt: new Date('2026-03-10T10:00:00.000Z'),
      },
    ]);

    const req = {
      params: { supplierCode: 'INNPRO' },
    } as unknown as Request;
    const res = createResponse();

    await controller.listBySupplier(req, res);

    expect(repository.listSupplierPricingRules).toHaveBeenCalledWith('innpro');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) }),
    );
  });

  it('creates pricing rule via upsert', async () => {
    repository.upsertSupplierPricingRule.mockResolvedValue({
      supplierCode: 'innpro',
      categoryKey: 'lighting',
      markupPercent: 22,
      active: true,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      updatedAt: new Date('2026-03-10T10:00:00.000Z'),
    });

    const req = {
      body: {
        supplierCode: 'INNPRO',
        categoryKey: ' Lighting ',
        markupPercent: 22,
        active: true,
      },
    } as Request;
    const res = createResponse();

    await controller.create(req, res);

    expect(repository.upsertSupplierPricingRule).toHaveBeenCalledWith({
      supplierCode: 'innpro',
      categoryKey: 'lighting',
      markupPercent: 22,
      active: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ categoryKey: 'lighting' }) }),
    );
  });

  it('updates pricing rule by route params', async () => {
    repository.upsertSupplierPricingRule.mockResolvedValue({
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 18,
      active: false,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      updatedAt: new Date('2026-03-10T10:05:00.000Z'),
    });

    const req = {
      params: { supplierCode: 'INNPRO', categoryKey: 'Gaming' },
      body: { markupPercent: 18, active: false },
    } as unknown as Request;
    const res = createResponse();

    await controller.upsertByKey(req, res);

    expect(repository.upsertSupplierPricingRule).toHaveBeenCalledWith({
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 18,
      active: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ categoryKey: 'gaming' }) }),
    );
  });

  it('toggles active flag on an existing rule', async () => {
    repository.updateSupplierPricingRuleActive.mockResolvedValue({
      supplierCode: 'innpro',
      categoryKey: 'audio',
      markupPercent: 20,
      active: false,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      updatedAt: new Date('2026-03-10T10:10:00.000Z'),
    });

    const req = {
      params: { supplierCode: 'INNPRO', categoryKey: 'Audio' },
      body: { active: false },
    } as unknown as Request;
    const res = createResponse();

    await controller.setActive(req, res);

    expect(repository.updateSupplierPricingRuleActive).toHaveBeenCalledWith('innpro', 'audio', false);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.objectContaining({ active: false }) }),
    );
  });

  it('returns 404 when patching active for missing rule', async () => {
    repository.updateSupplierPricingRuleActive.mockResolvedValue(null);

    const req = {
      params: { supplierCode: 'innpro', categoryKey: 'missing' },
      body: { active: true },
    } as unknown as Request;
    const res = createResponse();

    await controller.setActive(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(repository.updateSupplierPricingRuleActive).toHaveBeenCalledWith('innpro', 'missing', true);
  });

  it('maps repository errors to 500 with generic message', async () => {
    repository.listSupplierPricingRules.mockRejectedValue(new Error('db exploded'));

    const req = { params: { supplierCode: 'innpro' } } as unknown as Request;
    const res = createResponse();

    await controller.listBySupplier(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Internal server error' }),
      }),
    );
  });
});
