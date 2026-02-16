/**
 * ValidateDiscountCode Use-Case Tests
 * Unit tests for discount code validation
 *
 * @module Tests/Application
 */

import { ValidateDiscountCode } from '../../src/application/use-cases/ValidateDiscountCode';
import { DiscountCode } from '../../src/domain/entities/DiscountCode';
import { IDiscountCodeRepository } from '../../src/domain/repositories/IDiscountCodeRepository';
import { DiscountCalculationService } from '../../src/domain/services/DiscountCalculationService';

// Mock repository
class MockDiscountCodeRepository implements IDiscountCodeRepository {
  private codes: Map<string, DiscountCode> = new Map();

  async save(code: DiscountCode): Promise<DiscountCode> {
    this.codes.set(code.code, code);
    return code;
  }

  async findByCode(code: string): Promise<DiscountCode | null> {
    return this.codes.get(code.toUpperCase()) || null;
  }

  async findById(id: string): Promise<DiscountCode | null> {
    for (const code of this.codes.values()) {
      if (code.id === id) return code;
    }
    return null;
  }

  async findByCampaign(campaignId: string): Promise<DiscountCode[]> {
    return Array.from(this.codes.values()).filter((c) => c.campaignId === campaignId);
  }

  async findActive(): Promise<DiscountCode[]> {
    return Array.from(this.codes.values()).filter((c) => c.getIsActive());
  }

  async findWithFilter(): Promise<any> {
    return { items: [], total: 0, page: 1, pages: 0 };
  }

  async incrementUsage(codeId: string): Promise<DiscountCode> {
    throw new Error('Not implemented');
  }

  async incrementUsageIfAvailable(codeId: string): Promise<DiscountCode | null> {
    throw new Error('Not implemented');
  }

  async validateCode(): Promise<boolean> {
    return true;
  }

  async findExpired(): Promise<DiscountCode[]> {
    return [];
  }

  async findExpiringCodes(): Promise<DiscountCode[]> {
    return [];
  }

  async count(): Promise<number> {
    return 0;
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }

  async getCustomerUsageCount(): Promise<number> {
    return 0;
  }
}

describe('ValidateDiscountCode Use-Case', () => {
  let useCase: ValidateDiscountCode;
  let repository: MockDiscountCodeRepository;
  const now = new Date();
  const validFrom = new Date(now.getTime() - 1000 * 60 * 60);
  const validTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    repository = new MockDiscountCodeRepository();
    const calculationService = new DiscountCalculationService();
    useCase = new ValidateDiscountCode(repository, calculationService);

    // Create and save test code
    const testCode = new DiscountCode(
      'code_001',
      'camp_123',
      'SUMMER20',
      'PERCENTAGE',
      20,
      100,
      50,
      validFrom,
      validTo,
      1000,
      0,
      5,
      [],
      [],
      [],
      true,
      true,
      'user_123',
      now,
    );
    await repository.save(testCode);
  });

  describe('Valid Code Validation', () => {
    it('should validate valid code', async () => {
      const result = await useCase.execute({
        code: 'SUMMER20',
        orderAmount: 150,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 150, quantity: 1 }],
        customerId: 'cust_123',
      });

      expect(result.isValid).toBe(true);
      expect(result.estimatedDiscount).toBe(30); // 20% of 150
      expect(result.code).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should include code details in response', async () => {
      const result = await useCase.execute({
        code: 'SUMMER20',
        orderAmount: 150,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 150, quantity: 1 }],
      });

      expect(result.code).toEqual({
        id: 'code_001',
        code: 'SUMMER20',
        type: 'PERCENTAGE',
        value: 20,
      });
    });
  });

  describe('Invalid Code Validation', () => {
    it('should reject non-existent code', async () => {
      const result = await useCase.execute({
        code: 'NONEXISTENT',
        orderAmount: 150,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 150, quantity: 1 }],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject inactive code', async () => {
      const inactiveCode = new DiscountCode(
        'code_002',
        'camp_123',
        'INACTIVE',
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
        false, // inactive
        true,
        'user_123',
        now,
      );
      await repository.save(inactiveCode);

      const result = await useCase.execute({
        code: 'INACTIVE',
        orderAmount: 150,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 150, quantity: 1 }],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should reject expired code', async () => {
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
        now,
      );
      await repository.save(expiredCode);

      const result = await useCase.execute({
        code: 'EXPIRED',
        orderAmount: 150,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 150, quantity: 1 }],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject order below minimum amount', async () => {
      const result = await useCase.execute({
        code: 'SUMMER20',
        orderAmount: 50,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 50, quantity: 1 }],
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Minimum order amount');
    });
  });

  describe('Estimated Discount', () => {
    it('should calculate estimated discount correctly', async () => {
      const result = await useCase.execute({
        code: 'SUMMER20',
        orderAmount: 200,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 200, quantity: 1 }],
      });

      expect(result.estimatedDiscount).toBe(50); // 20% of 200, capped at 50
    });

    it('should respect maximum discount cap', async () => {
      const result = await useCase.execute({
        code: 'SUMMER20',
        orderAmount: 500,
        items: [{ productId: 'p1', categoryId: 'c1', amount: 500, quantity: 1 }],
      });

      // 20% of 500 = 100, but capped at 50
      expect(result.estimatedDiscount).toBeLessThanOrEqual(50);
    });
  });
});
