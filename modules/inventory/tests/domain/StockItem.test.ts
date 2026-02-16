import { describe, it, expect, beforeEach } from '@jest/globals';
import { StockItem } from '../../src/domain/entities/StockItem';

describe('StockItem', () => {
  let stockItem: StockItem;

  beforeEach(() => {
    stockItem = new StockItem(
      'product-1',
      'warehouse-1',
      100,
      20,
      30,
    );
  });

  it('should calculate available quantity as quantity minus reserved', () => {
    expect(stockItem.getAvailableQuantity()).toBe(80);
  });

  it('should calculate available quantity after modification', () => {
    stockItem.updateQuantity(150);
    expect(stockItem.getAvailableQuantity()).toBe(130);

    stockItem.updateReservedQuantity(40);
    expect(stockItem.getAvailableQuantity()).toBe(110);
  });

  it('should identify low stock when available quantity is at or below threshold', () => {
    expect(stockItem.isLowStock()).toBe(false);

    stockItem.updateQuantity(100);
    stockItem.updateReservedQuantity(71);
    expect(stockItem.isLowStock()).toBe(true);
  });

  it('should identify low stock at exact threshold', () => {
    stockItem.updateQuantity(100);
    stockItem.updateReservedQuantity(70);
    expect(stockItem.isLowStock()).toBe(true);
  });

  it('should throw when reserving more than available', () => {
    expect(() => {
      stockItem.reserve(85);
    }).toThrow('Insufficient stock to reserve: need 85, available 80');
  });

  it('should successfully reserve stock when available', () => {
    stockItem.reserve(50);
    expect(stockItem.getReservedQuantity()).toBe(70);
    expect(stockItem.getAvailableQuantity()).toBe(30);
  });

  it('should successfully release reservation', () => {
    stockItem.updateReservedQuantity(50);
    expect(stockItem.getReservedQuantity()).toBe(50);

    stockItem.release(30);
    expect(stockItem.getReservedQuantity()).toBe(20);
    expect(stockItem.getAvailableQuantity()).toBe(80);
  });

  it('should not allow releasing more than reserved', () => {
    expect(stockItem.getReservedQuantity()).toBe(20);

    // Should handle gracefully - clamped to available reserved
    stockItem.release(50);
    expect(stockItem.getReservedQuantity()).toBe(0);
  });
});
