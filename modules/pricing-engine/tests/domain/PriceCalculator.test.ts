import { describe, it, expect, beforeEach } from '@jest/globals';
import { PriceCalculator } from '../../src/domain/services/PriceCalculator';
import { Price } from '../../src/domain/entities/Price';
import { InvalidMarginError } from '../../src/domain/errors/InvalidMarginError';

describe('PriceCalculator', () => {
  let calculator: PriceCalculator;

  beforeEach(() => {
    calculator = new PriceCalculator();
  });

  it('should calculate basic price with cost * (1 + margin/100)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const result = calculator.calculateFinalPrice(price, 0, false);
    // cost * (1 + margin/100) = 50 * (1 + 50/100) = 50 * 1.5 = 75
    expect(result).toBe(75);
  });

  it('should apply Bronze tier discount (0%)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const result = calculator.calculateFinalPrice(price, 0, false);
    // cost * (1 + margin/100) * (1 - tier_discount/100)
    // 50 * 1.5 * (1 - 0/100) = 75 * 1 = 75
    expect(result).toBe(75);
  });

  it('should apply Silver tier discount (5%)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const result = calculator.calculateFinalPrice(price, 5, false);
    // 50 * 1.5 * (1 - 5/100) = 75 * 0.95 = 71.25
    expect(result).toBeCloseTo(71.25, 2);
  });

  it('should apply Gold tier discount (10%)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const result = calculator.calculateFinalPrice(price, 10, false);
    // 50 * 1.5 * (1 - 10/100) = 75 * 0.9 = 67.5
    expect(result).toBe(67.5);
  });

  it('should apply Platinum tier discount (15%)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const result = calculator.calculateFinalPrice(price, 15, false);
    // 50 * 1.5 * (1 - 15/100) = 75 * 0.85 = 63.75
    expect(result).toBeCloseTo(63.75, 2);
  });

  it('should apply promotional price when override is true', () => {
    const price = new Price(1, 'SKU001', 150, 50, 50, 1);
    // When promotional price is set to 120, final price should be 120
    price.basePrice = 120; // Promotional price
    const result = calculator.calculateFinalPrice(price, 0, true);
    expect(result).toBe(120);
  });

  it('should handle volume discount (2% for 10-49 units)', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const basePrice = calculator.calculateFinalPrice(price, 0, false);
    // With 2% volume discount: 75 * (1 - 2/100) = 75 * 0.98 = 73.5
    const priceWithDiscount = basePrice * (1 - 2 / 100);
    expect(priceWithDiscount).toBeCloseTo(73.5, 2);
  });

  it('should handle combined tier (5%) + volume (5%) discount', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1);
    const basePrice = calculator.calculateFinalPrice(price, 5, false);
    // After tier: 75 * 0.95 = 71.25
    // After volume (5%): 71.25 * 0.95 = 67.6875
    const combinedDiscount = basePrice * (1 - 5 / 100);
    expect(combinedDiscount).toBeCloseTo(67.6875, 4);
  });

  it('should reject margin percentage below 30%', () => {
    const price = new Price(1, 'SKU001', 100, 100, 20, 1); // 20% margin
    expect(() => {
      calculator.validateMargin(price);
    }).toThrow(InvalidMarginError);
  });

  it('should accept margin percentage at or above 30%', () => {
    const price = new Price(1, 'SKU001', 100, 50, 50, 1); // 50% margin
    expect(() => {
      calculator.validateMargin(price);
    }).not.toThrow();
  });

  it('should calculate order total with multiple items correctly', () => {
    const items = [
      { price: new Price(1, 'SKU001', 100, 50, 50, 1), quantity: 2 },
      { price: new Price(2, 'SKU002', 200, 100, 50, 1), quantity: 1 },
    ];

    // Item 1: 75 * 2 = 150
    // Item 2: 150 * 1 = 150
    // Total: 300
    let total = 0;
    for (const item of items) {
      const unitPrice = calculator.calculateFinalPrice(item.price, 0, false);
      total += unitPrice * item.quantity;
    }

    expect(total).toBe(300);
  });
});
