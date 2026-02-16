/**
 * ReviewRegistration Use Case Tests
 * Tests approval/rejection workflow
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ReviewRegistration,
  ReviewRegistrationInput,
  ReviewRegistrationOutput,
} from '../../src/application/use-cases/ReviewRegistration';
import {
  InvalidRegistrationStateError,
} from '../../src/domain/errors/b2b.errors';

describe('ReviewRegistration Use Case', () => {
  let useCase: ReviewRegistration;
  let mockRegistrationRepository: any;
  let mockCustomerRepository: any;
  let mockTierService: any;
  let mockEventPublisher: jest.MockedFunction<(event: string, data: unknown) => Promise<void>>;
  let mockNotificationService: jest.MockedFunction<(data: unknown) => Promise<void>>;

  beforeEach(() => {
    mockRegistrationRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockCustomerRepository = {
      save: jest.fn(),
    };

    mockTierService = {
      getPaymentTermsForTier: jest.fn(),
    };

    mockEventPublisher = jest.fn(async () => undefined);
    mockNotificationService = jest.fn(async () => undefined);

    useCase = new ReviewRegistration(
      mockRegistrationRepository,
      mockCustomerRepository,
      mockTierService,
      mockEventPublisher,
      mockNotificationService
    );
  });

  describe('Happy Path - Approval', () => {
    it('should approve PENDING registration with default tier', async () => {
      const registration = createMockRegistration('reg-001', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-001',
        action: 'APPROVE',
        reviewerId: 'admin-001',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-001',
        registrationId: 'reg-001',
        companyName: 'Tech Solutions SRL',
        cui: '12345678',
        tier: 'STANDARD',
        creditLimit: 10000,
      });
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);

      const result = await useCase.execute(input);

      expect(result.registrationId).toBe('reg-001');
      expect(result.customerId).toBe('cust-001');
      expect(registration.approve).toHaveBeenCalledWith('admin-001', 'STANDARD', 10000, 30);
      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.registration_approved',
        expect.any(Object)
      );
    });

    it('should approve with custom tier and credit limit', async () => {
      const registration = createMockRegistration('reg-002', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-002',
        action: 'APPROVE',
        tier: 'PREMIUM',
        creditLimit: 50000,
        paymentTermsDays: 60,
        reviewerId: 'admin-002',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-002',
        registrationId: 'reg-002',
        companyName: 'Enterprise Inc',
        cui: '87654321',
        tier: 'PREMIUM',
        creditLimit: 50000,
      });

      const result = await useCase.execute(input);

      expect(registration.approve).toHaveBeenCalledWith('admin-002', 'PREMIUM', 50000, 60);
      expect(result.customerId).toBeDefined();
    });

    it('should approve UNDER_REVIEW registration', async () => {
      const registration = createMockRegistration('reg-003', 'UNDER_REVIEW');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-003',
        action: 'APPROVE',
        reviewerId: 'admin-003',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-003',
        registrationId: 'reg-003',
        companyName: 'Review Company',
        cui: '11111111',
        tier: 'STANDARD',
        creditLimit: 10000,
      });
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);

      const result = await useCase.execute(input);

      expect(result.customerId).toBeDefined();
      expect(mockEventPublisher).toHaveBeenCalledWith('b2b.registration_approved', expect.any(Object));
    });

    it('should create B2BCustomer with correct tier and credit', async () => {
      const registration = createMockRegistration('reg-004', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-004',
        action: 'APPROVE',
        tier: 'ENTERPRISE',
        creditLimit: 100000,
        reviewerId: 'admin-004',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      const savedCustomer = {
        id: 'cust-004',
        registrationId: 'reg-004',
        companyName: 'Enterprise Corp',
        cui: '22222222',
        tier: 'ENTERPRISE',
        creditLimit: 100000,
      };

      mockCustomerRepository.save.mockResolvedValue(savedCustomer);

      const result = await useCase.execute(input);

      expect(result.customerId).toBe('cust-004');
      expect(mockCustomerRepository.save).toHaveBeenCalled();
    });

    it('should publish approval event with correct payload', async () => {
      const registration = createMockRegistration('reg-005', 'PENDING');
      registration.companyName = 'Event Test Company';
      registration.email = 'test@company.ro';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-005',
        action: 'APPROVE',
        tier: 'STANDARD',
        creditLimit: 25000,
        reviewerId: 'admin-005',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-005',
        registrationId: 'reg-005',
      });
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);

      await useCase.execute(input);

      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.registration_approved',
        expect.objectContaining({
          registrationId: 'reg-005',
          customerId: 'cust-005',
          companyName: 'Event Test Company',
          email: 'test@company.ro',
          tier: 'STANDARD',
          creditLimit: 25000,
        })
      );
    });

    it('should send approval notification to customer', async () => {
      const registration = createMockRegistration('reg-006', 'PENDING');
      registration.companyName = 'Notify Company';
      registration.email = 'notify@company.ro';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-006',
        action: 'APPROVE',
        tier: 'PREMIUM',
        creditLimit: 75000,
        reviewerId: 'admin-006',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-006',
        registrationId: 'reg-006',
      });
      mockTierService.getPaymentTermsForTier.mockReturnValue(45);

      await useCase.execute(input);

      expect(mockNotificationService).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'B2B_REGISTRATION_APPROVED',
          customerId: 'cust-006',
          companyName: 'Notify Company',
          tier: 'PREMIUM',
          creditLimit: 75000,
        })
      );
    });
  });

  describe('Happy Path - Rejection', () => {
    it('should reject PENDING registration', async () => {
      const registration = createMockRegistration('reg-101', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-101',
        action: 'REJECT',
        reason: 'Incomplete documentation',
        reviewerId: 'admin-101',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      const result = await useCase.execute(input);

      expect(result.registrationId).toBe('reg-101');
      expect(result.status).toBe('REJECTED');
      expect(registration.reject).toHaveBeenCalledWith('admin-101', 'Incomplete documentation');
      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.registration_rejected',
        expect.any(Object)
      );
    });

    it('should reject UNDER_REVIEW registration', async () => {
      const registration = createMockRegistration('reg-102', 'UNDER_REVIEW');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-102',
        action: 'REJECT',
        reason: 'Failed compliance check',
        reviewerId: 'admin-102',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      const result = await useCase.execute(input);

      expect(registration.reject).toHaveBeenCalledWith('admin-102', 'Failed compliance check');
      expect(mockEventPublisher).toHaveBeenCalledWith('b2b.registration_rejected', expect.any(Object));
    });

    it('should use default rejection reason when not provided', async () => {
      const registration = createMockRegistration('reg-103', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-103',
        action: 'REJECT',
        // No reason provided
        reviewerId: 'admin-103',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      await useCase.execute(input);

      expect(registration.reject).toHaveBeenCalledWith('admin-103', 'No reason provided');
    });

    it('should publish rejection event with correct payload', async () => {
      const registration = createMockRegistration('reg-104', 'PENDING');
      registration.companyName = 'Rejected Company';
      registration.email = 'rejected@company.ro';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-104',
        action: 'REJECT',
        reason: 'Payment terms not acceptable',
        reviewerId: 'admin-104',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      await useCase.execute(input);

      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.registration_rejected',
        expect.objectContaining({
          registrationId: 'reg-104',
          companyName: 'Rejected Company',
          email: 'rejected@company.ro',
          reason: 'Payment terms not acceptable',
        })
      );
    });

    it('should send rejection notification to customer', async () => {
      const registration = createMockRegistration('reg-105', 'PENDING');
      registration.companyName = 'Notified Company';
      registration.email = 'notified@company.ro';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-105',
        action: 'REJECT',
        reason: 'Suspicious financial history',
        reviewerId: 'admin-105',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      await useCase.execute(input);

      expect(mockNotificationService).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'B2B_REGISTRATION_REJECTED',
          email: 'notified@company.ro',
          companyName: 'Notified Company',
          reason: 'Suspicious financial history',
        })
      );
    });
  });

  describe('Error Cases', () => {
    it('should throw NotFoundError when registration does not exist', async () => {
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-nonexistent',
        action: 'APPROVE',
        reviewerId: 'admin-001',
      };

      mockRegistrationRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow();
      expect(mockCustomerRepository.save).not.toHaveBeenCalled();
    });

    it('should throw InvalidRegistrationStateError when approving APPROVED registration', async () => {
      const registration = createMockRegistration('reg-200', 'APPROVED');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-200',
        action: 'APPROVE',
        reviewerId: 'admin-200',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidRegistrationStateError);
      expect(mockCustomerRepository.save).not.toHaveBeenCalled();
    });

    it('should throw InvalidRegistrationStateError when approving REJECTED registration', async () => {
      const registration = createMockRegistration('reg-201', 'REJECTED');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-201',
        action: 'APPROVE',
        reviewerId: 'admin-201',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidRegistrationStateError);
    });

    it('should throw InvalidRegistrationStateError when rejecting APPROVED registration', async () => {
      const registration = createMockRegistration('reg-202', 'APPROVED');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-202',
        action: 'REJECT',
        reason: 'Changed mind',
        reviewerId: 'admin-202',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidRegistrationStateError);
    });

    it('should throw InvalidRegistrationStateError when rejecting already REJECTED', async () => {
      const registration = createMockRegistration('reg-203', 'REJECTED');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-203',
        action: 'REJECT',
        reason: 'Double reject',
        reviewerId: 'admin-203',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidRegistrationStateError);
    });
  });

  describe('Tier and Credit Management', () => {
    it('should use tier-specific payment terms when not provided', async () => {
      const registration = createMockRegistration('reg-300', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-300',
        action: 'APPROVE',
        tier: 'PREMIUM',
        // No paymentTermsDays
        reviewerId: 'admin-300',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockTierService.getPaymentTermsForTier.mockReturnValue(45); // PREMIUM = 45 days
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-300',
        registrationId: 'reg-300',
      });

      await useCase.execute(input);

      expect(mockTierService.getPaymentTermsForTier).toHaveBeenCalledWith('PREMIUM');
      expect(registration.approve).toHaveBeenCalledWith(
        'admin-300',
        'PREMIUM',
        10000, // default credit
        45 // from service
      );
    });

    it('should override default credit limit with provided value', async () => {
      const registration = createMockRegistration('reg-301', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-301',
        action: 'APPROVE',
        creditLimit: 250000,
        reviewerId: 'admin-301',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-301',
        registrationId: 'reg-301',
      });

      await useCase.execute(input);

      expect(registration.approve).toHaveBeenCalledWith(
        'admin-301',
        'STANDARD', // default tier
        250000, // custom credit
        30
      );
    });

    it('should handle different tier tiers correctly', async () => {
      const tiers = ['STANDARD', 'PREMIUM', 'ENTERPRISE', 'VIP'];
      const paymentTerms = [30, 45, 60, 90];

      for (let i = 0; i < tiers.length; i++) {
        const registration = createMockRegistration(`reg-3${i}0`, 'PENDING');
        const input: ReviewRegistrationInput = {
          registrationId: `reg-3${i}0`,
          action: 'APPROVE',
          tier: tiers[i] as any,
          reviewerId: `admin-3${i}0`,
        };

        mockRegistrationRepository.findById.mockResolvedValue(registration);
        mockRegistrationRepository.save.mockResolvedValue(registration);
        mockTierService.getPaymentTermsForTier.mockReturnValue(paymentTerms[i]);
        mockCustomerRepository.save.mockResolvedValue({
          id: `cust-3${i}0`,
          registrationId: `reg-3${i}0`,
        });

        await useCase.execute(input);

        expect(registration.approve).toHaveBeenCalledWith(
          `admin-3${i}0`,
          tiers[i],
          10000,
          paymentTerms[i]
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle reviewer ID correctly', async () => {
      const registration = createMockRegistration('reg-400', 'PENDING');
      const input: ReviewRegistrationInput = {
        registrationId: 'reg-400',
        action: 'APPROVE',
        reviewerId: 'special-admin-with-long-id-12345',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-400',
        registrationId: 'reg-400',
      });

      await useCase.execute(input);

      expect(registration.approve).toHaveBeenCalledWith(
        'special-admin-with-long-id-12345',
        expect.any(String),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle rejection with long reason text', async () => {
      const registration = createMockRegistration('reg-401', 'PENDING');
      const longReason =
        'After careful review of the provided documentation, including financial statements, tax records, and business plan, we have determined that this registration does not meet our compliance requirements at this time due to discrepancies in reporting.';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-401',
        action: 'REJECT',
        reason: longReason,
        reviewerId: 'admin-401',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);

      await useCase.execute(input);

      expect(registration.reject).toHaveBeenCalledWith('admin-401', longReason);
    });

    it('should ensure customer belongs to correct registration', async () => {
      const registration = createMockRegistration('reg-402', 'PENDING');
      registration.companyName = 'Specific Company';
      registration.cui = '99999999';
      registration.email = 'specific@company.ro';

      const input: ReviewRegistrationInput = {
        registrationId: 'reg-402',
        action: 'APPROVE',
        reviewerId: 'admin-402',
      };

      mockRegistrationRepository.findById.mockResolvedValue(registration);
      mockRegistrationRepository.save.mockResolvedValue(registration);
      mockTierService.getPaymentTermsForTier.mockReturnValue(30);
      mockCustomerRepository.save.mockResolvedValue({
        id: 'cust-402',
        registrationId: 'reg-402',
        companyName: 'Specific Company',
        cui: '99999999',
      });

      const result = await useCase.execute(input);

      // Verify customer was saved with correct registration relationship
      const savedCustomerCall = mockCustomerRepository.save.mock.calls[0][0];
      expect(savedCustomerCall.registrationId).toBe('reg-402');
    });
  });
});

// Helper function to create mock registration
function createMockRegistration(id: string, status: string): any {
  const registration: any = {
    id,
    status,
    companyName: 'Test Company',
    email: 'test@company.ro',
    cui: '12345678',
  };

  registration.approve = jest.fn(() => {
    registration.status = 'APPROVED';
  });

  registration.reject = jest.fn(() => {
    registration.status = 'REJECTED';
  });

  return registration;
}
