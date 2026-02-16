import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteNotFoundError, QuoteExpiredError } from '../errors/QuoteErrors';

export interface IEmailService {
  sendQuoteEmail(
    to: string,
    customerName: string,
    quoteNumber: string,
    validUntil: Date,
  ): Promise<void>;
}

export interface IWhatsAppService {
  sendQuoteMessage(
    phoneNumber: string,
    customerName: string,
    quoteNumber: string,
  ): Promise<void>;
}

export class SendQuote {
  constructor(
    private quoteRepository: IQuoteRepository,
    private emailService: IEmailService,
    private whatsAppService?: IWhatsAppService,
  ) {}

  async execute(quoteId: string, sendWhatsApp: boolean = false): Promise<void> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (quote.isExpired()) {
      throw new QuoteExpiredError(quote.quoteNumber);
    }

    quote.send();
    await this.quoteRepository.update(quote);

    await this.emailService.sendQuoteEmail(
      quote.customerEmail,
      quote.customerName,
      quote.quoteNumber,
      quote.validUntil,
    );

    if (sendWhatsApp && this.whatsAppService) {
      // Extract phone number from billing address or customer data
      // This is a simplified version - in production, fetch from customer service
      const phoneNumber = '+40123456789'; // Placeholder
      await this.whatsAppService.sendQuoteMessage(
        phoneNumber,
        quote.customerName,
        quote.quoteNumber,
      );
    }
  }
}
