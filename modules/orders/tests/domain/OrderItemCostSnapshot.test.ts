import { beforeEach, describe, expect, it } from '@jest/globals';
import { OrderItem } from '../../src/domain/entities/OrderItem';

describe('OrderItem Cost Snapshot', () => {
  let itemWithCost: OrderItem;
  let itemWithoutCost: OrderItem;

  beforeEach(() => {
    itemWithCost = new OrderItem({
      id: 'item-cost-1',
      productId: 10,
      sku: 'COST-SKU-001',
      productName: 'Widget A',
      quantity: 2,
      unitPrice: 100,
      costPriceSnapshot: 70,
      costSource: 'pricing_engine',
    });

    itemWithoutCost = new OrderItem({
      id: 'item-nocost-1',
      productId: 20,
      sku: 'NOCOST-SKU-001',
      productName: 'Widget B',
      quantity: 3,
      unitPrice: 50,
    });
  });

  it('should create OrderItem with cost_price_snapshot and cost_source', () => {
    expect(itemWithCost.costPriceSnapshot).toBe(70);
    expect(itemWithCost.costSource).toBe('pricing_engine');
  });

  it('should create OrderItem without cost (null defaults)', () => {
    expect(itemWithoutCost.costPriceSnapshot).toBeNull();
    expect(itemWithoutCost.costSource).toBeNull();
  });

  it('should calculate grossProfit correctly', () => {
    // quantity=2, unitPrice=100, costPriceSnapshot=70
    // lineTotal = 200, totalCost = 140, grossProfit = 60
    const grossProfit = itemWithCost.getGrossProfit();
    expect(grossProfit).toBe(60);
  });

  it('should calculate grossMarginPercent correctly', () => {
    // (100 - 70) / 100 * 100 = 30%
    const margin = itemWithCost.getGrossMarginPercent();
    expect(margin).toBe(30);
  });

  it('should return null for grossProfit when costPriceSnapshot is null', () => {
    expect(itemWithoutCost.getGrossProfit()).toBeNull();
  });

  it('should return null for grossMarginPercent when costPriceSnapshot is null', () => {
    expect(itemWithoutCost.getGrossMarginPercent()).toBeNull();
  });

  it('should include cost fields in toJSON()', () => {
    const json = itemWithCost.toJSON();
    expect(json.costPriceSnapshot).toBe(70);
    expect(json.costSource).toBe('pricing_engine');
    expect(json.grossProfit).toBe(60);
    expect(json.grossMarginPercent).toBe(30);

    const jsonNoCost = itemWithoutCost.toJSON();
    expect(jsonNoCost.costPriceSnapshot).toBeNull();
    expect(jsonNoCost.costSource).toBeNull();
    expect(jsonNoCost.grossProfit).toBeNull();
    expect(jsonNoCost.grossMarginPercent).toBeNull();
  });

  it('should handle zero unit price for margin calculation', () => {
    const item = new OrderItem({
      id: 'item-zero-price',
      productId: 30,
      sku: 'ZERO-PRICE-001',
      productName: 'Free Sample',
      quantity: 1,
      unitPrice: 0,
      costPriceSnapshot: 10,
      costSource: 'manual',
    });

    // margin is undefined when unitPrice is 0 (division by zero guard)
    expect(item.getGrossMarginPercent()).toBeNull();
    // grossProfit is still calculable: (0 * 1) - (10 * 1) = -10
    expect(item.getGrossProfit()).toBe(-10);
  });

  it('should handle zero cost correctly', () => {
    const item = new OrderItem({
      id: 'item-zero-cost',
      productId: 40,
      sku: 'ZERO-COST-001',
      productName: 'Gift Item',
      quantity: 1,
      unitPrice: 100,
      costPriceSnapshot: 0,
      costSource: 'estimated',
    });

    // margin = (100 - 0) / 100 * 100 = 100%
    expect(item.getGrossMarginPercent()).toBe(100);
    // grossProfit = (100 * 1) - (0 * 1) = 100
    expect(item.getGrossProfit()).toBe(100);
  });

  it('should preserve all cost source types', () => {
    const sources = [
      'metadata',
      'pricing_engine',
      'smartbill_invoice',
      'excel_import',
      'manual',
      'estimated',
      'backfill_metadata',
      'backfill_estimated',
    ] as const;

    for (const source of sources) {
      const item = new OrderItem({
        id: `item-${source}`,
        productId: 99,
        sku: 'SRC-SKU',
        productName: 'Source Test',
        quantity: 1,
        unitPrice: 50,
        costPriceSnapshot: 25,
        costSource: source,
      });
      expect(item.costSource).toBe(source);
    }
  });
});
