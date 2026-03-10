import { describe, expect, it, jest } from '@jest/globals';

import { TypeOrmSupplierRepository } from '../../src/infrastructure/repositories/TypeOrmSupplierRepository';

type QueryFn = jest.MockedFunction<(sql: string, params?: unknown[]) => Promise<any[]>>;

const createRepository = (queryImpl?: QueryFn) => {
  const query = queryImpl ?? (jest.fn(async () => []) as QueryFn);
  const supplierRepository = { query } as any;

  const repository = new TypeOrmSupplierRepository(
    supplierRepository,
    {} as any,
    {} as any,
    {} as any,
  );

  return { repository, query };
};

describe('TypeOrmSupplierRepository - supplier pricing rules', () => {
  it('lists pricing rules for a supplier code', async () => {
    const { repository } = createRepository(
      jest.fn(async () => [
        {
          supplier_code: 'innpro',
          category_key: 'audio',
          markup_percent: '12.5',
          active: true,
          created_at: new Date('2026-03-10T10:00:00.000Z'),
          updated_at: new Date('2026-03-10T10:00:00.000Z'),
        },
      ]) as QueryFn,
    );

    const result = await repository.listSupplierPricingRules('innpro');

    expect(result).toEqual([
      {
        supplierCode: 'innpro',
        categoryKey: 'audio',
        markupPercent: 12.5,
        active: true,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        updatedAt: new Date('2026-03-10T10:00:00.000Z'),
      },
    ]);
  });

  it('gets a pricing rule by supplier code and category key', async () => {
    const { repository } = createRepository(
      jest.fn(async () => [
        {
          supplier_code: 'innpro',
          category_key: 'lighting',
          markup_percent: 20,
          active: false,
          created_at: new Date('2026-03-10T09:00:00.000Z'),
          updated_at: new Date('2026-03-10T11:00:00.000Z'),
        },
      ]) as QueryFn,
    );

    const result = await repository.getSupplierPricingRule('innpro', 'lighting');

    expect(result).toEqual({
      supplierCode: 'innpro',
      categoryKey: 'lighting',
      markupPercent: 20,
      active: false,
      createdAt: new Date('2026-03-10T09:00:00.000Z'),
      updatedAt: new Date('2026-03-10T11:00:00.000Z'),
    });
  });

  it('returns null when no pricing rule exists for supplier/category', async () => {
    const { repository } = createRepository(jest.fn(async () => []) as QueryFn);

    const result = await repository.getSupplierPricingRule('innpro', 'missing');

    expect(result).toBeNull();
  });

  it('upserts a pricing rule and returns the persisted value', async () => {
    const query = jest.fn(async () => [
      {
        supplier_code: 'innpro',
        category_key: 'gaming',
        markup_percent: '17',
        active: true,
        created_at: new Date('2026-03-10T08:00:00.000Z'),
        updated_at: new Date('2026-03-10T12:00:00.000Z'),
      },
    ]) as QueryFn;

    const { repository } = createRepository(query);

    const result = await repository.upsertSupplierPricingRule({
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 17,
      active: true,
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual(['innpro', 'gaming', 17, true]);
    expect(result).toEqual({
      supplierCode: 'innpro',
      categoryKey: 'gaming',
      markupPercent: 17,
      active: true,
      createdAt: new Date('2026-03-10T08:00:00.000Z'),
      updatedAt: new Date('2026-03-10T12:00:00.000Z'),
    });
  });

  it('upsert does not force active=true when active is omitted', async () => {
    const query = jest.fn(async () => [
      {
        supplier_code: 'innpro',
        category_key: 'audio',
        markup_percent: '19.5',
        active: false,
        created_at: new Date('2026-03-10T08:00:00.000Z'),
        updated_at: new Date('2026-03-10T12:00:00.000Z'),
      },
    ]) as QueryFn;

    const { repository } = createRepository(query);

    const result = await repository.upsertSupplierPricingRule({
      supplierCode: 'innpro',
      categoryKey: 'audio',
      markupPercent: 19.5,
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('WHEN $4 IS NULL THEN supplier_pricing_rules.active');
    expect(query.mock.calls[0]?.[1]).toEqual(['innpro', 'audio', 19.5, null]);
    expect(result.active).toBe(false);
  });
});
