/**
 * RegisterB2B Use Case Tests
 * Tests B2B registration with CUI/IBAN validation
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RegisterB2B, RegisterB2BInput, RegisterB2BOutput } from '../../src/application/use-cases/RegisterB2B';
import { RegistrationExistsError, InvalidCuiError, InvalidIbanError } from '../../src/domain/errors/b2b.errors';

describe('RegisterB2B Use Case', () => {
  let useCase: RegisterB2B;
  let mockRegistrationRepository: any;
  let mockCuiValidationService: any;
  let mockEventPublisher: jest.MockedFunction<(event: string, data: unknown) => Promise<void>>;
  let mockNotificationService: jest.MockedFunction<(data: unknown) => Promise<void>>;

  beforeEach(() => {
    mockRegistrationRepository = {
      findByCui: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
    };

    mockCuiValidationService = {
      validateFormat: jest.fn(),
    };

    mockEventPublisher = jest.fn(async () => undefined);
    mockNotificationService = jest.fn(async () => undefined);

    useCase = new RegisterB2B(
      mockRegistrationRepository,
      mockCuiValidationService,
      mockEventPublisher,
      mockNotificationService
    );
  });

  describe('Happy Path - B2B Registration', () => {
    it('should register new B2B company with valid data', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Tech Solutions SRL',
        cui: '12345674',
        regCom: 'J40/1234/2020',
        legalAddress: 'Str. Tech, nr. 1, sector 1, Bucuresti',
        deliveryAddress: 'Str. Tech, nr. 2, sector 1, Bucuresti',
        contactPerson: 'John Doe',
        email: 'john@techsolutions.ro',
        phone: '+40721234567',
        bankName: 'BRD',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
        paymentTermsDays: 30,
        notes: 'Trusted partner',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-001',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.id).toBe('reg-001');
      expect(result.status).toBe('PENDING');
      expect(result.companyName).toBe(input.companyName);
      expect(result.email).toBe(input.email);
      expect(result.cui).toBe(input.cui);
      expect(mockRegistrationRepository.save).toHaveBeenCalled();
      expect(mockEventPublisher).toHaveBeenCalledWith('b2b.registration_submitted', expect.any(Object));
      expect(mockNotificationService).toHaveBeenCalled();
    });

    it('should handle optional fields gracefully', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Simple Trading',
        cui: '87654329',
        regCom: 'J40/5678/2021',
        legalAddress: 'Str. Main, sector 2, Bucuresti',
        deliveryAddress: 'Str. Main, sector 2, Bucuresti',
        contactPerson: 'Jane Smith',
        email: 'jane@simpletrading.ro',
        phone: '+40723456789',
        bankName: 'ING',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'PREMIUM',
        // No paymentTermsDays
        // No notes
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-002',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.id).toBeDefined();
      expect(mockRegistrationRepository.save).toHaveBeenCalled();
    });

    it('should publish registration event with correct payload', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Event Test Company',
        cui: '11111110',
        regCom: 'J40/9999/2022',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test Person',
        email: 'test@company.ro',
        phone: '+40721111111',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-003',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        requestedTier: input.requestedTier,
        createdAt: new Date(),
      });

      await useCase.execute(input);

      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.registration_submitted',
        expect.objectContaining({
          registrationId: 'reg-003',
          companyName: 'Event Test Company',
          email: 'test@company.ro',
          cui: '11111110',
          requestedTier: 'STANDARD',
        })
      );
    });

    it('should send notification to admin', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Notification Test',
        cui: '22222229',
        regCom: 'J40/8888/2023',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test Person',
        email: 'notify@company.ro',
        phone: '+40722222222',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'ENTERPRISE',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-004',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      await useCase.execute(input);

      expect(mockNotificationService).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'B2B_REGISTRATION_SUBMITTED',
          registrationId: 'reg-004',
          companyName: 'Notification Test',
          recipientId: 'b2b-admin',
        })
      );
    });
  });

  describe('CUI Validation', () => {
    it('should reject invalid CUI format', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Invalid CUI Company',
        cui: 'INVALID123',
        regCom: 'J40/1111/2020',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'test@invalid.ro',
        phone: '+40721234567',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(false);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidCuiError);
      expect(mockRegistrationRepository.save).not.toHaveBeenCalled();
    });

    it('should reject CUI that already exists', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Duplicate CUI Company',
        cui: '99999999',
        regCom: 'J40/2222/2021',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'duplicate@company.ro',
        phone: '+40723333333',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue({
        id: 'reg-existing',
        cui: '99999999',
      });

      await expect(useCase.execute(input)).rejects.toThrow(RegistrationExistsError);
      expect(mockRegistrationRepository.save).not.toHaveBeenCalled();
    });

    it('should validate Romanian CUI format (8 digits)', async () => {
      const input: RegisterB2BInput = {
        companyName: 'CUI Format Test',
        cui: '12345674', // Valid: 8 digits
        regCom: 'J40/3333/2022',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'format@company.ro',
        phone: '+40724444444',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-format',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.id).toBeDefined();
      expect(mockCuiValidationService.validateFormat).toHaveBeenCalledWith('12345674');
    });
  });

  describe('IBAN Validation', () => {
    it('should reject invalid IBAN', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Invalid IBAN Company',
        cui: '33333333',
        regCom: 'J40/4444/2023',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'iban@company.ro',
        phone: '+40725555555',
        bankName: 'BT',
        iban: 'INVALID_IBAN_FORMAT',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(InvalidIbanError);
      expect(mockRegistrationRepository.save).not.toHaveBeenCalled();
    });

    it('should accept valid Romanian IBAN', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Valid IBAN Company',
        cui: '44444447',
        regCom: 'J40/5555/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'validiban@company.ro',
        phone: '+40726666666',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000', // Valid RO IBAN
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-validiban',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.id).toBeDefined();
      expect(mockRegistrationRepository.save).toHaveBeenCalled();
    });

    it('should validate IBAN at use case level', async () => {
      const validIban = 'RO49AAAA1B31007593840000';
      const input: RegisterB2BInput = {
        companyName: 'IBAN Validation Test',
        cui: '55555556',
        regCom: 'J40/6666/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'ibantest@company.ro',
        phone: '+40727777777',
        bankName: 'ING',
        iban: validIban,
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-ibantest',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.id).toBeDefined();
    });
  });

  describe('Email Uniqueness', () => {
    it('should reject email that already exists', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Email Duplicate Company',
        cui: '66666666',
        regCom: 'J40/7777/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'duplicate@email.ro',
        phone: '+40728888888',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue({
        id: 'reg-existing-email',
        email: 'duplicate@email.ro',
      });

      await expect(useCase.execute(input)).rejects.toThrow(RegistrationExistsError);
      expect(mockRegistrationRepository.save).not.toHaveBeenCalled();
    });

    it('should allow new unique emails', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Unique Email Company',
        cui: '77777774',
        regCom: 'J40/8888/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'unique@company.ro',
        phone: '+40729999999',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-unique',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.email).toBe('unique@company.ro');
      expect(mockRegistrationRepository.save).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should validate all required fields before checking uniqueness', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Invalid Format Check',
        cui: 'INVALID', // Invalid CUI
        regCom: 'J40/9999/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'alreadyexists@company.ro',
        phone: '+40720000000',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(false);

      // Should throw InvalidCuiError before checking email uniqueness
      await expect(useCase.execute(input)).rejects.toThrow(InvalidCuiError);
      expect(mockRegistrationRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should handle special characters in company name', async () => {
      const input: RegisterB2BInput = {
        companyName: 'Tech & Solutions (Romania) SRL',
        cui: '88888883',
        regCom: 'J40/1111/2024',
        legalAddress: 'Str. & Co., nr. 1-3',
        deliveryAddress: 'Str. & Co., nr. 1-3',
        contactPerson: "O'Brien & Partners",
        email: 'special@company.ro',
        phone: '+40721111111',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);
      mockRegistrationRepository.save.mockResolvedValue({
        id: 'reg-special',
        status: 'PENDING',
        companyName: input.companyName,
        email: input.email,
        cui: input.cui,
        createdAt: new Date(),
      });

      const result = await useCase.execute(input);

      expect(result.companyName).toBe('Tech & Solutions (Romania) SRL');
    });

    it('should generate unique registration ID', async () => {
      const input: RegisterB2BInput = {
        companyName: 'ID Generation Test',
        cui: '89898982',
        regCom: 'J40/2222/2024',
        legalAddress: 'Address 1',
        deliveryAddress: 'Address 2',
        contactPerson: 'Test',
        email: 'idtest@company.ro',
        phone: '+40722222222',
        bankName: 'BT',
        iban: 'RO49AAAA1B31007593840000',
        requestedTier: 'STANDARD',
      };

      mockCuiValidationService.validateFormat.mockReturnValue(true);
      mockRegistrationRepository.findByCui.mockResolvedValue(null);
      mockRegistrationRepository.findByEmail.mockResolvedValue(null);

      const persistedRegistrationId = 'reg-generated';
      mockRegistrationRepository.save.mockImplementation(async (registration: any) => {
        return {
          id: persistedRegistrationId,
          status: 'PENDING',
          companyName: input.companyName,
          email: input.email,
          cui: input.cui,
          createdAt: new Date(),
        };
      });

      const result = await useCase.execute(input);

      expect(result.id).toBe(persistedRegistrationId);
    });
  });
});
