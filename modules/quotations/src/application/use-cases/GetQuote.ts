import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { Quote } from '../../domain/entities/Quote';
import { QuoteNotFoundError } from '../errors/QuoteErrors';

export class GetQuote {
  constructor(private quoteRepository: IQuoteRepository) {}

  async execute(quoteId: string): Promise<Quote> {
    const quote = await this.quoteRepository.findById(quoteId);
    if (!quote) {
      throw new QuoteNotFoundError(quoteId);
    }
    return quote;
  }

  async executeByQuoteNumber(quoteNumber: string): Promise<Quote> {
    const quote = await this.quoteRepository.findByQuoteNumber(quoteNumber);
    if (!quote) {
      throw new Error(`Quote with number ${quoteNumber} not found`);
    }
    return quote;
  }
}
