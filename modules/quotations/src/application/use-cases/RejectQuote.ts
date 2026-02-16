import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteNotFoundError } from '../errors/QuoteErrors';

export class RejectQuote {
  constructor(private quoteRepository: IQuoteRepository) {}

  async execute(quoteId: string, reason: string): Promise<void> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }

    quote.reject(reason);
    await this.quoteRepository.update(quote);
  }
}
