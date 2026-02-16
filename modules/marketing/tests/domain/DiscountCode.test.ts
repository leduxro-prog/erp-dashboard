/**
 * DiscountCode Entity Tests
 * Unit tests for DiscountCode domain entity business logic
 *
 * @module Tests/Domain
 */

import { DiscountCode } from '../../src/domain/entities/DiscountCode';

describe('DiscountCode Entity', () => {
  let code: DiscountCode;
  const now = new Date();
  const validFrom = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
  const validTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  beforeEach(() => {
    code = new DiscountCode(
      'code_001',
      'camp_123',
      'SUMMER20',
      'PERCENTAGE',
      20,
      100, // min order $100
      50, // max discount $50
      validFrom,
      validTo,
      1000, // max uses
      0, // current uses
      5, // max per customer
      [],
      [],
      [],
      true, // is active
      true, // is stackable
      'user_123',
      now
    );
  });

  describe('Code Status', () => {
    it('should be active when activated', () => {
      expect(code.getIsActive()).toBe(true);
    });

    it('should deactivate', () => {
      code.deactivate();
      expect(code.getIsActive()).toBe(false);
    });

    it('should reactivate', () => {
      code.deactivate();
      code.activate();
      expect(code.getIsActive()).toBe(true);
    });

    it('should identify not expired', () => {
      expect(code.isExpired()).toBe(false);
    });

    it('should identify expired', () => {
      const expiredCode = new DiscountCode(
        'code_002',
        'camp_123',
        'EXPIRED',
        'FIXED_AMOUNT',
        10,
        null,
        null,
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        100,
        50,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(expiredCode.isExpired()).toBe(true);
    });
  });

  describe('Code Validation', () => {
    it('should validate active non-expired code with sufficient order amount', () => {
      expect(code.isValid(150, 'cust_123')).toBe(true);
    });

    it('should reject inactive code', () => {
      code.deactivate();
      expect(code.isValid(150, 'cust_123')).toBe(false);
    });

    it('should reject expired code', () => {
      const expiredCode = new DiscountCode(
        'code_003',
        'camp_123',
        'EXPIRED',
        'PERCENTAGE',
        10,
        null,
        null,
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        100,
        0,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(expiredCode.isValid(150, 'cust_123')).toBe(false);
    });

    it('should reject order below minimum amount', () => {
      expect(code.isValid(50, 'cust_123')).toBe(false);
    });

    it('should reject when usage limit reached', () => {
      const limitedCode = new DiscountCode(
        'code_004',
        'camp_123',
        'LIMITED',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        10,
        10, // Already used 10 times
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(limitedCode.isValid(150, 'cust_123')).toBe(false);
    });
  });

  describe('Code Usage', () => {
    it('should increment usage', () => {
      expect(code.getCurrentUses()).toBe(0);
      code.use();
      expect(code.getCurrentUses()).toBe(1);
    });

    it('should throw when usage limit reached', () => {
      const limitedCode = new DiscountCode(
        'code_005',
        'camp_123',
        'LIMITED',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        1,
        1, // Already used once
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(() => limitedCode.use()).toThrow();
    });

    it('should identify when fully used', () => {
      const limitedCode = new DiscountCode(
        'code_006',
        'camp_123',
        'LIMITED',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        1,
        1,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(limitedCode.isFullyUsed()).toBe(true);
    });

    it('should get remaining uses', () => {
      const remaining = code.getRemainingUses();
      expect(remaining).toBe(1000);
    });

    it('should return null remaining for unlimited code', () => {
      const unlimitedCode = new DiscountCode(
        'code_007',
        'camp_123',
        'UNLIMITED',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        null,
        0,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(unlimitedCode.getRemainingUses()).toBeNull();
    });
  });

  describe('Per-Customer Usage', () => {
    it('should allow customer within limit', () => {
      expect(code.canUse('cust_123', 2)).toBe(true);
    });

    it('should reject customer exceeding limit', () => {
      expect(code.canUse('cust_123', 5)).toBe(false);
    });

    it('should allow unlimited per-customer uses', () => {
      const unlimitedCode = new DiscountCode(
        'code_008',
        'camp_123',
        'UNLIMITED_CUSTOMER',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        100,
        0,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      expect(unlimitedCode.canUse('cust_123', 100)).toBe(true);
    });
  });

  describe('Discount Calculation', () => {
    it('should calculate percentage discount', () => {
      const items = [{ productId: 'p1', categoryId: 'c1', amount: 100 }];
      const discount = code.calculateDiscount(100, items);
      expect(discount).toBe(20); // 20% of 100
    });

    it('should apply maximum discount cap', () => {
      const items = [{ productId: 'p1', categoryId: 'c1', amount: 300 }];
      const discount = code.calculateDiscount(300, items);
      expect(discount).toBe(50); // Capped at $50
    });

    it('should not exceed order amount', () => {
      const fixedCode = new DiscountCode(
        'code_009',
        'camp_123',
        'FIXED100',
        'FIXED_AMOUNT',
        100,
        null,
        null,
        validFrom,
        validTo,
        100,
        0,
        null,
        [],
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      const items = [{ productId: 'p1', categoryId: 'c1', amount: 50 }];
      const discount = fixedCode.calculateDiscount(50, items);
      expect(discount).toEqual(50);
    });

    it('should throw for non-applicable items', () => {
      const restrictedCode = new DiscountCode(
        'code_010',
        'camp_123',
        'RESTRICTED',
        'PERCENTAGE',
        10,
        null,
        null,
        validFrom,
        validTo,
        100,
        0,
        null,
        ['p1', 'p2'], // Only applies to p1, p2
        [],
        [],
        true,
        true,
        'user_123',
        now
      );
      const items = [{ productId: 'p3', categoryId: 'c1', amount: 100 }];
      expect(() => restrictedCode.calculateDiscount(100, items)).toThrow();
    });
  });
});
