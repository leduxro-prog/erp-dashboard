import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteStatus } from '../../domain/entities/Quote';

export interface ILogger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
}

export class ExpireOverdueQuotes {
  constructor(private quoteRepository: IQuoteRepository, private logger: ILogger) {}

  async execute(): Promise<{ expired: number; error: number }> {
    let expiredCount = 0;
    let errorCount = 0;

    try {
      const expiredQuotes = await this.quoteRepository.findExpiredQuotes();

      for (const quote of expiredQuotes) {
        try {
          if (!quote.isExpired()) {
            continue;
          }

          if (quote.status === QuoteStatus.ACCEPTED) {
            continue; // Don't expire accepted quotes
          }

          quote.expire();
          await this.quoteRepository.update(quote);
          expiredCount++;

          this.logger.info(`Quote ${quote.quoteNumber} expired`, {
            quoteId: quote.id,
            expiredAt: new Date(),
          });
        } catch (error) {
          errorCount++;
          this.logger.error(`Failed to expire quote ${quote.quoteNumber}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to execute ExpireOverdueQuotes job', error);
    }

    return { expired: expiredCount, error: errorCount };
  }
}
