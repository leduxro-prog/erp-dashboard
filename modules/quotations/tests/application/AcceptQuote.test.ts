import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AcceptQuote } from '../../src/application/use-cases/AcceptQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { QuoteExpiredError, QuoteNotFoundError } from '../../src/application/errors/QuoteErrors';

describe('AcceptQuote Use Case', () => {
  let useCase: AcceptQuote;
  let mockRepository: jest.Mocked<IQuoteRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    useCase = new AcceptQuote(mockRepository);
  });

  it('should accept quote successfully', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      quoteNumber: 'QTE-001',
      isExpired: jest.fn().mockReturnValue(false),
      accept: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);
    mockRepository.update.mockResolvedValue(mockQuote as any);

    await useCase.execute('quote-1');

    expect(mockQuote.accept).toHaveBeenCalledTimes(1);
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999')).rejects.toThrow(QuoteNotFoundError);
  });

  it('should validate quote can be accepted', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'EXPIRED',
      quoteNumber: 'QTE-001',
      isExpired: jest.fn().mockReturnValue(true),
      accept: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    await expect(useCase.execute('quote-1')).rejects.toThrow(QuoteExpiredError);
    expect(mockQuote.accept).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should propagate domain errors from accept', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      quoteNumber: 'QTE-001',
      isExpired: jest.fn().mockReturnValue(false),
      accept: jest.fn().mockImplementation(() => {
        throw new Error('Only sent quotes can be accepted');
      }),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    await expect(useCase.execute('quote-1')).rejects.toThrow('Only sent quotes can be accepted');
  });

  it('should return void after successful acceptance', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      quoteNumber: 'QTE-001',
      isExpired: jest.fn().mockReturnValue(false),
      accept: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);
    mockRepository.update.mockResolvedValue(mockQuote as any);

    const result = await useCase.execute('quote-1');

    expect(result).toBeUndefined();
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });
});
