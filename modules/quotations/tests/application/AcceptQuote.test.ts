import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AcceptQuote } from '../../src/application/use-cases/AcceptQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { Quote, QuoteStatus } from '../../src/domain/entities/Quote';
import { QuoteExpiredError, QuoteNotFoundError } from '../../src/application/errors/QuoteErrors';

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
    const mockQuote = makeQuote({ status: QuoteStatus.SENT });
    const acceptSpy = jest.spyOn(mockQuote, 'accept');
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockResolvedValue(mockQuote);

    await useCase.execute('quote-1');

    expect(acceptSpy).toHaveBeenCalledTimes(1);
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999')).rejects.toThrow(QuoteNotFoundError);
  });

  it('should validate quote can be accepted', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.EXPIRED });
    const acceptSpy = jest.spyOn(mockQuote, 'accept');

    mockRepository.findById.mockResolvedValue(mockQuote);

    await expect(useCase.execute('quote-1')).rejects.toThrow(QuoteExpiredError);
    expect(acceptSpy).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should propagate domain errors from accept', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.PENDING });
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);

    await expect(useCase.execute('quote-1')).rejects.toThrow('Only sent quotes can be accepted');
  });

  it('should return void after successful acceptance', async () => {
    const mockQuote = makeQuote({ status: QuoteStatus.SENT });
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockResolvedValue(mockQuote);

    const result = await useCase.execute('quote-1');

    expect(result).toBeUndefined();
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });
});
