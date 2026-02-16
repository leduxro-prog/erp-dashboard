import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ExpireOverdueQuotes,
  ILogger,
} from '../../src/application/use-cases/ExpireOverdueQuotes';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { QuoteStatus } from '../../src/domain/entities/Quote';

describe('ExpireOverdueQuotes Use Case', () => {
  let useCase: ExpireOverdueQuotes;
  let mockRepository: jest.Mocked<IQuoteRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      findExpiredQuotes: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    useCase = new ExpireOverdueQuotes(mockRepository, mockLogger);
  });

  it('should expire overdue quotes', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        quoteNumber: 'QTE-001',
        status: QuoteStatus.SENT,
        isExpired: jest.fn().mockReturnValue(true),
        expire: jest.fn(),
      },
      {
        id: 'quote-2',
        quoteNumber: 'QTE-002',
        status: QuoteStatus.PENDING,
        isExpired: jest.fn().mockReturnValue(true),
        expire: jest.fn(),
      },
    ];

    mockRepository.findExpiredQuotes.mockResolvedValue(mockQuotes as any);
    mockRepository.update.mockImplementation(async quote => quote);

    const result = await useCase.execute();

    expect(mockQuotes[0].expire).toHaveBeenCalled();
    expect(mockQuotes[1].expire).toHaveBeenCalled();
    expect(mockRepository.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ expired: 2, error: 0 });
  });

  it('should skip quotes that are not expired', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        quoteNumber: 'QTE-001',
        status: QuoteStatus.SENT,
        isExpired: jest.fn().mockReturnValue(false),
        expire: jest.fn(),
      },
    ];

    mockRepository.findExpiredQuotes.mockResolvedValue(mockQuotes as any);

    const result = await useCase.execute();

    expect(mockQuotes[0].expire).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
    expect(result).toEqual({ expired: 0, error: 0 });
  });

  it('should skip accepted quotes even when they are expired', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        quoteNumber: 'QTE-001',
        status: QuoteStatus.ACCEPTED,
        isExpired: jest.fn().mockReturnValue(true),
        expire: jest.fn(),
      },
    ];

    mockRepository.findExpiredQuotes.mockResolvedValue(mockQuotes as any);

    const result = await useCase.execute();

    expect(mockQuotes[0].expire).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
    expect(result).toEqual({ expired: 0, error: 0 });
  });

  it('should handle expiration errors gracefully', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        quoteNumber: 'QTE-001',
        status: QuoteStatus.SENT,
        isExpired: jest.fn().mockReturnValue(true),
        expire: jest.fn().mockImplementation(() => {
          throw new Error('Already expired');
        }),
      },
    ];

    mockRepository.findExpiredQuotes.mockResolvedValue(mockQuotes as any);

    const result = await useCase.execute();

    expect(result).toEqual({ expired: 0, error: 1 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to expire quote QTE-001',
      expect.any(Error),
    );
  });

  it('should log repository failures and return zero counters', async () => {
    mockRepository.findExpiredQuotes.mockRejectedValue(new Error('DB unavailable'));

    const result = await useCase.execute();

    expect(result).toEqual({ expired: 0, error: 0 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to execute ExpireOverdueQuotes job',
      expect.any(Error),
    );
  });
});
