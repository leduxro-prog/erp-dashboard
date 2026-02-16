import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SendQuote,
  IEmailService,
  IWhatsAppService,
} from '../../src/application/use-cases/SendQuote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { QuoteExpiredError, QuoteNotFoundError } from '../../src/application/errors/QuoteErrors';

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
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      validUntil,
      isExpired: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as unknown as Awaited<ReturnType<typeof mockRepository.findById>>);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);

    await useCase.execute('quote-1');

    expect(mockQuote.send).toHaveBeenCalledTimes(1);
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
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      validUntil: new Date('2026-03-01T00:00:00.000Z'),
      isExpired: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as unknown as Awaited<ReturnType<typeof mockRepository.findById>>);

    await expect(useCase.execute('quote-1')).rejects.toThrow(QuoteExpiredError);
    expect(mockQuote.send).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('should handle email service failure gracefully', async () => {
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      validUntil: new Date('2026-03-01T00:00:00.000Z'),
      isExpired: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as unknown as Awaited<ReturnType<typeof mockRepository.findById>>);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockRejectedValue(new Error('Email service down'));

    await expect(useCase.execute('quote-1')).rejects.toThrow('Email service down');
    expect(mockRepository.update).toHaveBeenCalledWith(mockQuote);
  });

  it('should send WhatsApp message when requested', async () => {
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      validUntil: new Date('2026-03-01T00:00:00.000Z'),
      isExpired: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as unknown as Awaited<ReturnType<typeof mockRepository.findById>>);
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
    const mockQuote = {
      id: 'quote-1',
      quoteNumber: 'QTE-001',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      validUntil: new Date('2026-03-01T00:00:00.000Z'),
      isExpired: jest.fn().mockReturnValue(false),
      send: jest.fn(),
    };

    mockRepository.findById.mockResolvedValue(mockQuote as unknown as Awaited<ReturnType<typeof mockRepository.findById>>);
    mockRepository.update.mockImplementation(async quote => quote);
    mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);

    await useCase.execute('quote-1');

    expect(mockWhatsAppService.sendQuoteMessage).not.toHaveBeenCalled();
  });
});
