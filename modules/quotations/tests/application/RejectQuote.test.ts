import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RejectQuote } from '../../src/application/use-cases/RejectQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';

describe('RejectQuote Use Case', () => {
  let useCase: RejectQuote;
  let mockRepository: jest.Mocked<IQuoteRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    useCase = new RejectQuote(mockRepository);
  });

  it('should reject quote successfully', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      reject: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    await useCase.execute('quote-1', 'Price too high');

    expect(mockQuote.reject).toHaveBeenCalledWith('Price too high');
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999', 'Not found')).rejects.toThrow();
  });

  it('should require rejection reason', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      reject: jest.fn().mockImplementation(() => {
        throw new Error('Reason is required');
      }),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    await expect(useCase.execute('quote-1', '')).rejects.toThrow();
  });

  it('should prevent rejecting already rejected quote', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'REJECTED',
      reject: jest.fn().mockImplementation(() => {
        throw new Error('Quote already rejected');
      }),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    await expect(useCase.execute('quote-1', 'Test')).rejects.toThrow();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should return void on successful rejection', async () => {
    const mockQuote = {
      id: 'quote-1',
      status: 'SENT',
      customerId: 123,
      quoteNumber: 'QTE-001',
      reject: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    const result = await useCase.execute('quote-1', 'Price too high');

    expect(result).toBeUndefined();
    expect(mockRepository.update).toHaveBeenCalled();
  });
});
