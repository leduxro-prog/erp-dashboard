import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SendQuote,
  IEmailService,
  IWhatsAppService,
} from '../../src/application/use-cases/SendQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { Quote } from '../../src/domain/entities/Quote';
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

describe('SendQuote Use Case', () => {
  let useCase: SendQuote;
  let mockRepository: jest.Mocked<IQuoteRepository>;
  let mockEmailService: jest.Mocked<IEmailService>;
  let mockWhatsAppService: jest.Mocked<IWhatsAppService>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    mockEmailService = {
      sendQuoteEmail: jest.fn(),
    };

    mockWhatsAppService = {
      sendQuoteMessage: jest.fn(),
    };

    useCase = new SendQuote(mockRepository, mockEmailService, mockWhatsAppService);
  });

  it('should send quote successfully', async () => {
    const validUntil = new Date('2026-03-01T00:00:00.000Z');
    const mockQuote = makeQuote({ validUntil });
    const sendSpy = jest.spyOn(mockQuote, 'send');
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);

    await useCase.execute('quote-1');

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
    expect(mockEmailService.sendQuoteEmail).toHaveBeenCalledWith(
      'john@example.com',
      'John Doe',
      'QTE-001',
      validUntil,
    );
  });

  it('should throw error when quote not found', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('quote-999')).rejects.toThrow(QuoteNotFoundError);
  });

  it('should throw error when quote is expired', async () => {
    const mockQuote = makeQuote({ validUntil: new Date('2026-03-01T00:00:00.000Z') });
    const sendSpy = jest.spyOn(mockQuote, 'send');
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(true);

    mockRepository.findById.mockResolvedValue(mockQuote);

    await expect(useCase.execute('quote-1')).rejects.toThrow(QuoteExpiredError);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should handle email service failure gracefully', async () => {
    const mockQuote = makeQuote({ validUntil: new Date('2026-03-01T00:00:00.000Z') });
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockRejectedValue(new Error('Email service down'));

    await expect(useCase.execute('quote-1')).rejects.toThrow('Email service down');
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should send WhatsApp message when requested', async () => {
    const mockQuote = makeQuote({ validUntil: new Date('2026-03-01T00:00:00.000Z') });
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);
    mockWhatsAppService.sendQuoteMessage.mockResolvedValue(undefined);

    await useCase.execute('quote-1', true);

    expect(mockWhatsAppService.sendQuoteMessage).toHaveBeenCalledWith(
      '+40123456789',
      'John Doe',
      'QTE-001',
    );
  });

  it('should not send WhatsApp message by default', async () => {
    const mockQuote = makeQuote({ validUntil: new Date('2026-03-01T00:00:00.000Z') });
    jest.spyOn(mockQuote, 'isExpired').mockReturnValue(false);

    mockRepository.findById.mockResolvedValue(mockQuote);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);

    await useCase.execute('quote-1');

    expect(mockWhatsAppService.sendQuoteMessage).not.toHaveBeenCalled();
  });
});
