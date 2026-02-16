import { describe, it, expect, beforeEach } from '@jest/globals';
import { SupplierProductEntity } from '../../src/domain/entities/SupplierProduct';

describe('SupplierProductEntity', () => {
  let product: SupplierProductEntity;

  beforeEach(() => {
    product = new SupplierProductEntity({
      id: 1,
      supplierId: 1,
      supplierSku: 'TEST-001',
      name: 'Test Product',
      price: 100,
      currency: 'USD',
      stockQuantity: 50,
      lastScraped: new Date(),
      priceHistory: [
        { price: 100, date: new Date('2024-01-01') },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('hasPriceChanged', () => {
    it('should return true when price changes', () => {
      expect(product.hasPriceChanged(105)).toBe(true);
    });

    it('should return false when price remains same', () => {
      expect(product.hasPriceChanged(100)).toBe(false);
    });

    it('should detect price decrease', () => {
      expect(product.hasPriceChanged(95)).toBe(true);
    });
  });

  describe('priceChangePercentage', () => {
    it('should calculate positive percentage change', () => {
      const percentage = product.priceChangePercentage(110);
      expect(percentage).toBe(10);
    });

    it('should calculate negative percentage change', () => {
      const percentage = product.priceChangePercentage(90);
      expect(percentage).toBe(-10);
    });

    it('should return 0 for no price change', () => {
      const percentage = product.priceChangePercentage(100);
      expect(percentage).toBe(0);
    });

    it('should handle zero current price', () => {
      product.price = 0;
      const percentage = product.priceChangePercentage(100);
      expect(percentage).toBe(0);
    });

    it('should calculate large percentage increase', () => {
      const percentage = product.priceChangePercentage(200);
      expect(percentage).toBe(100);
    });

    it('should calculate large percentage decrease', () => {
      const percentage = product.priceChangePercentage(50);
      expect(percentage).toBe(-50);
    });
  });

  describe('isPriceChangeSignificant', () => {
    it('should return true for change exceeding threshold', () => {
      expect(product.isPriceChangeSignificant(115, 10)).toBe(true);
    });

    it('should return false for change below threshold', () => {
      expect(product.isPriceChangeSignificant(105, 10)).toBe(false);
    });

    it('should use default 10% threshold', () => {
      expect(product.isPriceChangeSignificant(111)).toBe(true);
      expect(product.isPriceChangeSignificant(109)).toBe(false);
    });

    it('should return false when price does not change', () => {
      expect(product.isPriceChangeSignificant(100, 10)).toBe(false);
    });

    it('should work with negative changes', () => {
      expect(product.isPriceChangeSignificant(85, 10)).toBe(true);
      expect(product.isPriceChangeSignificant(95, 10)).toBe(false);
    });

    it('should handle custom thresholds', () => {
      expect(product.isPriceChangeSignificant(120, 20)).toBe(false);
      expect(product.isPriceChangeSignificant(125, 20)).toBe(true);
    });
  });

  describe('recordPriceChange', () => {
    it('should add price to history', () => {
      const initialLength = product.priceHistory.length;
      product.recordPriceChange(105);
      expect(product.priceHistory.length).toBe(initialLength + 1);
      expect(product.priceHistory[initialLength].price).toBe(105);
    });

    it('should use provided timestamp', () => {
      const testDate = new Date('2024-06-01');
      product.recordPriceChange(105, testDate);
      const lastEntry = product.priceHistory[product.priceHistory.length - 1];
      expect(lastEntry.date).toEqual(testDate);
    });

    it('should limit history to 52 entries (1 year)', () => {
      // Add 52 entries
      for (let i = 0; i < 52; i++) {
        product.recordPriceChange(100 + i);
      }
      expect(product.priceHistory.length).toBeLessThanOrEqual(52);

      // Add one more
      product.recordPriceChange(200);
      expect(product.priceHistory.length).toBe(52);
    });
  });

  describe('getPriceHistory', () => {
    beforeEach(() => {
      const now = new Date();
      product.priceHistory = [
        { price: 100, date: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) }, // 12 weeks ago
        { price: 101, date: new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000) },  // 8 weeks ago
        { price: 102, date: new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000) },  // 4 weeks ago
        { price: 103, date: new Date(now.getTime() - 1 * 7 * 24 * 60 * 60 * 1000) },  // 1 week ago
        { price: 104, date: now },                                                      // today
      ];
    });

    it('should return history for last 12 weeks by default', () => {
      const history = product.getPriceHistory();
      expect(history.length).toBe(4); // All except the one from 12 weeks ago
    });

    it('should return history for specified weeks', () => {
      const history = product.getPriceHistory(4);
      expect(history.length).toBe(2); // 4 weeks ago and 1 week ago + today
    });

    it('should return empty array if no history in range', () => {
      const history = product.getPriceHistory(1);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAveragePrice', () => {
    beforeEach(() => {
      const now = new Date();
      product.priceHistory = [
        { price: 100, date: new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) },
        { price: 110, date: new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000) },
        { price: 120, date: new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000) },
        { price: 130, date: new Date(now.getTime() - 1 * 7 * 24 * 60 * 60 * 1000) },
      ];
    });

    it('should calculate average price for last 12 weeks', () => {
      const avg = product.getAveragePrice(12);
      // Average of 110, 120, 130 (excluding the one from 12 weeks ago)
      expect(avg).toBeCloseTo(120, 0);
    });

    it('should return current price if no history', () => {
      product.priceHistory = [];
      const avg = product.getAveragePrice();
      expect(avg).toBe(product.price);
    });
  });

  describe('stock status', () => {
    it('should detect low stock', () => {
      product.stockQuantity = 5;
      expect(product.isLowStock(10)).toBe(true);
    });

    it('should not detect low stock when above threshold', () => {
      product.stockQuantity = 15;
      expect(product.isLowStock(10)).toBe(false);
    });

    it('should detect out of stock', () => {
      product.stockQuantity = 0;
      expect(product.isOutOfStock()).toBe(true);
    });

    it('should not detect out of stock when in stock', () => {
      product.stockQuantity = 1;
      expect(product.isOutOfStock()).toBe(false);
    });
  });
});
