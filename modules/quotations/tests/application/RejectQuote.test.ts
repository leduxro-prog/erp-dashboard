import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RejectQuote } from '../../src/application/use-cases/RejectQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { Quote, QuoteStatus } from '../../src/domain/entities/Quote';
import { QuoteNotFoundError } from '../../src/application/errors/QuoteErrors';

const makeQuote = (overrides: Partial<Quote> = {}): Quote => {
  const quote = new Quote(
    'quote-1',
    'QTE-001',
    'customer-1',
    'John Doe',
    'john@example.com',
    [
      {
        id: 'item-1',
        productId: 'product-1',
        sku: 'SKU-001',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
    { street: 'Main 1', city: 'Bucharest', postcode: '010001', country: 'RO' },
    { street: 'Main 1', city: 'Bucharest', postcode: '010001', country: 'RO' },
    'Net 15',
    '2-3 days',
    'tester',
  );

  Object.assign(quote, overrides);
  return quote;
};

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
    const mockQuote = makeQuote({ status: QuoteStatus.SENT });
    const rejectSpy = jest.spyOn(mockQuote, 'reject');

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockResolvedValue(mockQuote);

    await useCase.execute('quote-1', 'Price too high');

    expect(rejectSpy).toHaveBeenCalledWith('Price too high');
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999', 'Not found')).rejects.toThrow(QuoteNotFoundError);
  });

  it('should persist rejection reason supplied to the domain entity', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.SENT });

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockResolvedValue(mockQuote);

    await useCase.execute('quote-1', 'Price too high');

    expect(mockQuote.rejectionReason).toBe('Price too high');
    expect(mockQuote.status).toBe(QuoteStatus.REJECTED);
  });

  it('should prevent rejecting already rejected quote', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.REJECTED });

    mockRepository.findById.mockResolvedValue(mockQuote);

    await expect(useCase.execute('quote-1', 'Test')).rejects.toThrow('Only sent quotes can be rejected');
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should return void on successful rejection', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.SENT });

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockResolvedValue(mockQuote);

    const result = await useCase.execute('quote-1', 'Price too high');

    expect(result).toBeUndefined();
    expect(mockRepository.update).toHaveBeenCalled();
  });
});
