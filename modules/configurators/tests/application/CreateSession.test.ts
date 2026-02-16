import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Logger } from 'winston';
import { CreateSession } from '../../src/application/use-cases/CreateSession';
import { ISessionRepository } from '../../src/domain/repositories/ISessionRepository';
import { ConfiguratorSession } from '../../src/domain/entities/ConfiguratorSession';

/**
 * CreateSession Use-Case Tests
 *
 * Tests for:
 * - Session creation with and without customer ID
 * - Session initialization
 * - Persistence
 */
describe('CreateSession Use-Case', () => {
  let createSession: CreateSession;
  let mockRepository: ISessionRepository;
  let mockLogger: Logger;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(async (session: ConfiguratorSession) => session),
      findById: jest.fn(async (_id: string) => undefined),
      findByToken: jest.fn(async (_token: string) => undefined),
      findByCustomer: jest.fn(async (_customerId: number, page: number, limit: number) => ({
        items: [],
        total: 0,
        page,
        limit,
      })),
      findActive: jest.fn(async () => []),
      deleteExpired: jest.fn(async () => 0),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    createSession = new CreateSession(mockRepository, mockLogger);
  });

  describe('Successful Creation', () => {
    it('should create MAGNETIC_TRACK session without customer', async () => {
      const result = await createSession.execute({
        type: 'MAGNETIC_TRACK',
      });

      expect(result.sessionId).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create LED_STRIP session with customer', async () => {
      const result = await createSession.execute({
        type: 'LED_STRIP',
        customerId: 123,
      });

      expect(result.sessionId).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalled();

      const savedSession = (mockRepository.save as any).mock.calls[0][0];
      expect(savedSession.customerId).toBe(123);
    });

    it('should set expiry to 24 hours from now', async () => {
      const beforeCreate = Date.now();
      const result = await createSession.execute({ type: 'MAGNETIC_TRACK' });
      const afterCreate = Date.now();

      const expiryMs = result.expiresAt.getTime();
      const expectedMin = beforeCreate + 24 * 60 * 60 * 1000;
      const expectedMax = afterCreate + 24 * 60 * 60 * 1000;

      expect(expiryMs).toBeGreaterThanOrEqual(expectedMin - 1000); // Allow 1s tolerance
      expect(expiryMs).toBeLessThanOrEqual(expectedMax + 1000);
    });

    it('should log session creation', async () => {
      await createSession.execute({
        type: 'MAGNETIC_TRACK',
        customerId: 456,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'CreateSession: Session created successfully',
        expect.objectContaining({
          type: 'MAGNETIC_TRACK',
          customerId: 456,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle repository save failure', async () => {
      const error = new Error('Database error');
      (mockRepository.save as any).mockRejectedValueOnce(error);

      await expect(
        createSession.execute({ type: 'MAGNETIC_TRACK' })
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'CreateSession: Failed to create session',
        expect.objectContaining({
          error: 'Database error',
        })
      );
    });
  });

  describe('Uniqueness', () => {
    it('should generate unique session tokens', async () => {
      const result1 = await createSession.execute({ type: 'MAGNETIC_TRACK' });
      const result2 = await createSession.execute({ type: 'MAGNETIC_TRACK' });

      expect(result1.sessionToken).not.toBe(result2.sessionToken);
    });

    it('should generate unique session IDs', async () => {
      const result1 = await createSession.execute({ type: 'MAGNETIC_TRACK' });
      const result2 = await createSession.execute({ type: 'MAGNETIC_TRACK' });

      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });
});
