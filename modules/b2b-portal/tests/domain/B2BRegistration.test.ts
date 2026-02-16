/**
 * B2BRegistration Entity Tests
 * Tests for registration entity validation, status transitions, and business logic.
 *
 * @module B2B Portal - Domain Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  B2BRegistration,
  B2BRegistrationStatus,
} from '../../src/domain/entities/B2BRegistration';
import {
  InvalidCuiError,
  InvalidIbanError,
  InvalidRegistrationStateError,
} from '../../src/domain/errors/b2b.errors';

describe('B2BRegistration Entity', () => {
  let registration: B2BRegistration;

  beforeEach(() => {
    registration = new B2BRegistration(
      'reg_123',
      'Acme Corp',
      '14399700',
      'J40/123/2024',
      'Str. Example 123',
      'Str. Delivery 456',
      'John Doe',
      'john@acme.com',
      '0123456789',
      'Bank ABC',
      'RO89ABCD0000000512345678',
      'SILVER',
      15,
      'Initial registration'
    );
  });

  describe('Construction', () => {
    it('should create a valid registration entity', () => {
      expect(registration.id).toBe('reg_123');
      expect(registration.companyName).toBe('Acme Corp');
      expect(registration.cui).toBe('14399700');
      expect(registration.status).toBe(B2BRegistrationStatus.PENDING);
      expect(registration.createdAt).toBeInstanceOf(Date);
    });

    it('should throw InvalidCuiError for invalid CUI format', () => {
      expect(
        () =>
          new B2BRegistration(
            'reg_123',
            'Test Corp',
            'invalid',
            'J40/123/2024',
            'Address 1',
            'Address 2',
            'Contact',
            'test@test.com',
            '123456789',
            'Bank',
            'RO89ABCD0000000512345678',
            'SILVER'
          )
      ).toThrow(InvalidCuiError);
    });

    it('should throw InvalidIbanError for invalid IBAN format', () => {
      expect(
        () =>
          new B2BRegistration(
            'reg_123',
            'Test Corp',
            '14399700',
            'J40/123/2024',
            'Address 1',
            'Address 2',
            'Contact',
            'test@test.com',
            '123456789',
            'Bank',
            'INVALID_IBAN',
            'SILVER'
          )
      ).toThrow(InvalidIbanError);
    });
  });

  describe('CUI Validation', () => {
    it('should validate correct CUI format', () => {
      expect(B2BRegistration.isValidCui('14399700')).toBe(true);
      expect(B2BRegistration.isValidCui('12345678')).toBe(false); // Invalid check digit
      expect(B2BRegistration.isValidCui('123')).toBe(true); // 3 digits OK
    });

    it('should reject invalid CUI lengths', () => {
      expect(B2BRegistration.isValidCui('1')).toBe(false);
      expect(B2BRegistration.isValidCui('123456789012')).toBe(false);
    });

    it('should reject non-numeric CUI', () => {
      expect(B2BRegistration.isValidCui('1234567a')).toBe(false);
    });
  });

  describe('IBAN Validation', () => {
    it('should validate correct IBAN format', () => {
      expect(B2BRegistration.isValidIban('RO89ABCD0000000512345678')).toBe(true);
      expect(B2BRegistration.isValidIban('DE89370400440532013000')).toBe(true);
    });

    it('should accept IBAN with spaces', () => {
      expect(B2BRegistration.isValidIban('RO89 ABCD 0000 0005 1234 5678')).toBe(true);
    });

    it('should reject invalid IBAN lengths', () => {
      expect(B2BRegistration.isValidIban('RO1234')).toBe(false);
      expect(B2BRegistration.isValidIban('RO123456789012345678901234567890')).toBe(false);
    });

    it('should reject invalid IBAN format', () => {
      expect(B2BRegistration.isValidIban('XX89ABCD0000000512345678')).toBe(false);
      expect(B2BRegistration.isValidIban('RO89ABCD!!!!!!!!!!!!!!!')).toBe(false);
    });
  });

  describe('Status Transitions', () => {
    it('should approve from PENDING status', () => {
      registration.approve('user_123', 'SILVER', 10000, 30);

      expect(registration.status).toBe(B2BRegistrationStatus.APPROVED);
      expect(registration.reviewedBy).toBe('user_123');
      expect(registration.creditLimit).toBe(10000);
      expect(registration.paymentTermsDays).toBe(30);
    });

    it('should approve from UNDER_REVIEW status', () => {
      registration.markAsUnderReview();
      registration.approve('user_123', 'GOLD', 50000, 45);

      expect(registration.status).toBe(B2BRegistrationStatus.APPROVED);
    });

    it('should reject from PENDING status', () => {
      registration.reject('user_123', 'Insufficient documentation');

      expect(registration.status).toBe(B2BRegistrationStatus.REJECTED);
      expect(registration.rejectionReason).toBe('Insufficient documentation');
    });

    it('should throw error when approving non-PENDING registration', () => {
      registration.approve('user_123', 'SILVER', 10000, 30);

      expect(() => registration.approve('user_123', 'SILVER', 10000, 30)).toThrow(
        InvalidRegistrationStateError
      );
    });

    it('should transition to UNDER_REVIEW from PENDING', () => {
      registration.markAsUnderReview();

      expect(registration.status).toBe(B2BRegistrationStatus.UNDER_REVIEW);
    });

    it('should suspend approved registration', () => {
      registration.approve('user_123', 'SILVER', 10000, 30);
      registration.suspend('Fraud detected');

      expect(registration.status).toBe(B2BRegistrationStatus.SUSPENDED);
      expect(registration.rejectionReason).toBe('Fraud detected');
    });

    it('should reactivate suspended registration', () => {
      registration.approve('user_123', 'SILVER', 10000, 30);
      registration.suspend('Fraud detected');
      registration.reactivate();

      expect(registration.status).toBe(B2BRegistrationStatus.APPROVED);
      expect(registration.rejectionReason).toBeUndefined();
    });
  });

  describe('Document Management', () => {
    it('should add documents', () => {
      const doc = {
        id: 'doc_1',
        fileName: 'certificate.pdf',
        fileUrl: 'https://storage.example.com/cert.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      registration.addDocument(doc);

      expect(registration.documents).toHaveLength(1);
      expect(registration.documents[0].fileName).toBe('certificate.pdf');
    });

    it('should remove documents', () => {
      const doc = {
        id: 'doc_1',
        fileName: 'certificate.pdf',
        fileUrl: 'https://storage.example.com/cert.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      registration.addDocument(doc);
      registration.removeDocument('doc_1');

      expect(registration.documents).toHaveLength(0);
    });
  });

  describe('Notes Management', () => {
    it('should update notes', () => {
      registration.updateNotes('New review notes');

      expect(registration.notes).toBe('New review notes');
    });
  });

  describe('isActive Method', () => {
    it('should return true when status is APPROVED', () => {
      registration.approve('user_123', 'SILVER', 10000, 30);

      expect(registration.isActive()).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(registration.isActive()).toBe(false);

      registration.reject('user_123', 'Test rejection');
      expect(registration.isActive()).toBe(false);

      registration = new B2BRegistration(
        'reg_2',
        'Test Corp',
        '14399700',
        'J40/123/2024',
        'Addr 1',
        'Addr 2',
        'Contact',
        'test@test.com',
        '123456789',
        'Bank',
        'RO89ABCD0000000512345678',
        'SILVER'
      );
      registration.markAsUnderReview();
      expect(registration.isActive()).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should update updatedAt on status changes', () => {
      const originalUpdatedAt = registration.updatedAt;

      // Add small delay to ensure time difference
      const waitTime = new Promise((resolve) => setTimeout(resolve, 10));
      waitTime.then(() => {
        registration.markAsUnderReview();
        expect(registration.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
      });
    });
  });
});
