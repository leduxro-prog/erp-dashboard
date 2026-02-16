import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SendReminders } from '../../src/application/use-cases/SendReminders';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';

describe('SendReminders Use Case', () => {
  let useCase: SendReminders;
  let mockRepository: jest.Mocked<IQuoteRepository>;
  let mockReminderService: any;
  let mockLogger: any;

  beforeEach(() => {
    mockRepository = {
      findPendingOrSentQuotes: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    mockReminderService = {
      sendExpirationReminder: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    useCase = new SendReminders(mockRepository, mockReminderService, mockLogger);
  });

  it('should send reminders for pending quotes', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        customerEmail: 'john@example.com',
        customerName: 'John Doe',
        quoteNumber: 'QTE-001',
        daysUntilExpiry: jest.fn().mockReturnValue(14),
        needsReminder: jest.fn().mockImplementation((days: any) => days === 14),
      },
      {
        id: 'quote-2',
        customerEmail: 'jane@example.com',
        customerName: 'Jane Doe',
        quoteNumber: 'QTE-002',
        daysUntilExpiry: jest.fn().mockReturnValue(10),
        needsReminder: jest.fn().mockImplementation((days: any) => days === 10),
      },
    ];

    mockRepository.findPendingOrSentQuotes.mockResolvedValue(mockQuotes as any);
    (mockReminderService.sendExpirationReminder as any).mockResolvedValue(undefined);

    const result = await useCase.execute();

    expect(mockReminderService.sendExpirationReminder).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 2, error: 0 });
  });

  it('should handle no pending quotes', async () => {
    mockRepository.findPendingOrSentQuotes.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 0, error: 0 });
    expect(mockReminderService.sendExpirationReminder).not.toHaveBeenCalled();
  });

  it('should skip quotes that do not need reminders', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        customerEmail: 'john@example.com',
        customerName: 'John Doe',
        quoteNumber: 'QTE-001',
        daysUntilExpiry: jest.fn().mockReturnValue(7),
        needsReminder: jest.fn().mockReturnValue(false),
      },
    ];

    mockRepository.findPendingOrSentQuotes.mockResolvedValue(mockQuotes as any);

    const result = await useCase.execute();

    expect(mockReminderService.sendExpirationReminder).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, error: 0 });
  });

  it('should handle email service failures gracefully', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        customerEmail: 'john@example.com',
        customerName: 'John Doe',
        quoteNumber: 'QTE-001',
        daysUntilExpiry: jest.fn().mockReturnValue(14),
        needsReminder: jest.fn().mockImplementation((days: any) => days === 14),
      },
      {
        id: 'quote-2',
        customerEmail: 'jane@example.com',
        customerName: 'Jane Doe',
        quoteNumber: 'QTE-002',
        daysUntilExpiry: jest.fn().mockReturnValue(10),
        needsReminder: jest.fn().mockImplementation((days: any) => days === 10),
      },
    ];

    mockRepository.findPendingOrSentQuotes.mockResolvedValue(mockQuotes as any);
    (mockReminderService.sendExpirationReminder as any).mockRejectedValueOnce(
      new Error('Email failed'),
    );
    (mockReminderService.sendExpirationReminder as any).mockResolvedValueOnce(undefined);

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 1, error: 1 });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should log and return zero counts when repository throws', async () => {
    mockRepository.findPendingOrSentQuotes.mockRejectedValue(
      new Error('Repository unavailable'),
    );

    const result = await useCase.execute();

    expect(result).toEqual({ sent: 0, error: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to execute SendReminders job',
      expect.any(Error),
    );
  });
});
