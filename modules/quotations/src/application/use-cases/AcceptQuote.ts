import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteNotFoundError, QuoteExpiredError } from '../errors/QuoteErrors';

export class AcceptQuote {
  constructor(private quoteRepository: IQuoteRepository) {}

  async execute(quoteId: string): Promise<void> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    if (quote.isExpired()) {
      throw new QuoteExpiredError(quote.quoteNumber);
    }

    quote.accept();
    await this.quoteRepository.update(quote);
  }
}
