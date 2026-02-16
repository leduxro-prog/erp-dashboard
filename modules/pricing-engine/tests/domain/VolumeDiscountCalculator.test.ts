import { describe, it, expect, beforeEach } from '@jest/globals';
import { VolumeDiscountCalculator } from '../../src/domain/services/VolumeDiscountCalculator';

describe('VolumeDiscountCalculator', () => {
  let calculator: VolumeDiscountCalculator;

  beforeEach(() => {
    calculator = new VolumeDiscountCalculator();
  });

  it('should return 0% discount for quantities below 10 units', () => {
    const discount = calculator.calculateVolumeDiscount(5);
    expect(discount).toBe(0);
  });

  it('should return 2% discount for quantities between 10-49 units', () => {
    const discount10 = calculator.calculateVolumeDiscount(10);
    const discount25 = calculator.calculateVolumeDiscount(25);
    const discount49 = calculator.calculateVolumeDiscount(49);

    expect(discount10).toBe(2);
    expect(discount25).toBe(2);
    expect(discount49).toBe(2);
  });

  it('should return 5% discount for quantities between 50-99 units', () => {
    const discount50 = calculator.calculateVolumeDiscount(50);
    const discount75 = calculator.calculateVolumeDiscount(75);
    const discount99 = calculator.calculateVolumeDiscount(99);

    expect(discount50).toBe(5);
    expect(discount75).toBe(5);
    expect(discount99).toBe(5);
  });

  it('should return 8% discount for quantities 100+ units', () => {
    const discount100 = calculator.calculateVolumeDiscount(100);
    const discount500 = calculator.calculateVolumeDiscount(500);
    const discount1000 = calculator.calculateVolumeDiscount(1000);

    expect(discount100).toBe(8);
    expect(discount500).toBe(8);
    expect(discount1000).toBe(8);
  });

  it('should return 0% discount for order value below 5000 RON', () => {
    const discount = calculator.calculateVolumeDiscountByValue(4999);
    expect(discount).toBe(0);
  });

  it('should return 3% discount for order value between 5000-14999 RON', () => {
    const discount5000 = calculator.calculateVolumeDiscountByValue(5000);
    const discount10000 = calculator.calculateVolumeDiscountByValue(10000);
    const discount14999 = calculator.calculateVolumeDiscountByValue(14999);

    expect(discount5000).toBe(3);
    expect(discount10000).toBe(3);
    expect(discount14999).toBe(3);
  });

  it('should return 6% discount for order value between 15000-29999 RON', () => {
    const discount15000 = calculator.calculateVolumeDiscountByValue(15000);
    const discount20000 = calculator.calculateVolumeDiscountByValue(20000);
    const discount29999 = calculator.calculateVolumeDiscountByValue(29999);

    expect(discount15000).toBe(6);
    expect(discount20000).toBe(6);
    expect(discount29999).toBe(6);
  });

  it('should return 10% discount for order value 30000+ RON', () => {
    const discount30000 = calculator.calculateVolumeDiscountByValue(30000);
    const discount50000 = calculator.calculateVolumeDiscountByValue(50000);
    const discount100000 = calculator.calculateVolumeDiscountByValue(100000);

    expect(discount30000).toBe(10);
    expect(discount50000).toBe(10);
    expect(discount100000).toBe(10);
  });
});
