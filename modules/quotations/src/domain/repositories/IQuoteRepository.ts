import { Quote, QuoteStatus } from '../entities/Quote';

export interface IQuoteRepository {
  save(quote: Quote): Promise<Quote>;
  findById(id: string): Promise<Quote | null>;
  findByQuoteNumber(quoteNumber: string): Promise<Quote | null>;
  findByCustomerId(customerId: string): Promise<Quote[]>;
  findAll(): Promise<Quote[]>;
  findByStatus(status: QuoteStatus): Promise<Quote[]>;
  findExpiredQuotes(): Promise<Quote[]>;
  findQuotesByExpirationDate(date: Date): Promise<Quote[]>;
  findPendingOrSentQuotes(): Promise<Quote[]>;
  update(quote: Quote): Promise<Quote>;
  delete(id: string): Promise<void>;
  countByCustomerId(customerId: string): Promise<number>;
  findWithPagination(page: number, limit: number): Promise<{ data: Quote[]; total: number }>;
  findByCustomerIdWithPagination(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Quote[]; total: number }>;
}

export const QUOTE_REPOSITORY_SYMBOL = Symbol('IQuoteRepository');
