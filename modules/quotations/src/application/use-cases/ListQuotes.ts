import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { Quote, QuoteStatus } from '../../domain/entities/Quote';

export interface ListQuotesFilter {
  customerId?: string;
  status?: QuoteStatus;
  page?: number;
  limit?: number;
}

export interface ListQuotesResponse {
  data: Quote[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class ListQuotes {
  constructor(private quoteRepository: IQuoteRepository) {}

  async execute(filter: ListQuotesFilter): Promise<ListQuotesResponse> {
    const page = filter.page || 1;
    const limit = filter.limit || 10;

    let data: Quote[];
    let total: number;

    if (filter.customerId) {
      const result = await this.quoteRepository.findByCustomerIdWithPagination(
        filter.customerId,
        page,
        limit,
      );
      data = result.data;
      total = result.total;
    } else {
      const result = await this.quoteRepository.findWithPagination(page, limit);
      data = result.data;
      total = result.total;
    }

    if (filter.status) {
      data = data.filter(quote => quote.status === filter.status);
    }

    return {
      data,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }
}
