import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetQuote } from '../../src/application/use-cases/GetQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';

describe('GetQuote Use Case', () => {
  let useCase: GetQuote;
  let mockRepository: jest.Mocked<IQuoteRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      findByQuoteNumber: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    useCase = new GetQuote(mockRepository);
  });

  it('should retrieve quote by ID', async () => {
    const mockQuote = { id: 'quote-1', quoteNumber: 'QTE-001', customerName: 'John Doe' };
    mockRepository.findById.mockResolvedValue(mockQuote as any);

    const result = await useCase.execute('quote-1');

    expect(result).toEqual(mockQuote);
  });

  it('should retrieve quote by number', async () => {
    const mockQuote = { id: 'quote-1', quoteNumber: 'QTE-001', customerName: 'John Doe' };
    mockRepository.findByQuoteNumber.mockResolvedValue(mockQuote as any);

    const result = await useCase.executeByQuoteNumber('QTE-001');

    expect(result).toEqual(mockQuote);
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999')).rejects.toThrow();
  });

  it('should return quote with all details', async () => {
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerId: 'customer-123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      items: [],
      subtotal: 1000,
      grandTotal: 1190,
      status: 'SENT',
    };

    mockRepository.findById.mockResolvedValue(mockQuote as any);

    const result = await useCase.execute('quote-1');

    expect(result).toMatchObject({
      customerId: 'customer-123',
      customerName: 'John Doe',
      status: 'SENT',
    });
  });
});
