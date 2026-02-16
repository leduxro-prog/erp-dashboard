import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListQuotes } from '../../src/application/use-cases/ListQuotes';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { QuoteStatus } from '../../src/domain/entities/Quote';

describe('ListQuotes Use Case', () => {
  let useCase: ListQuotes;
  let mockRepository: jest.Mocked<IQuoteRepository>;

  beforeEach(() => {
    mockRepository = {
      findWithPagination: jest.fn(),
      findByCustomerIdWithPagination: jest.fn(),
    } as unknown as jest.Mocked<IQuoteRepository>;

    useCase = new ListQuotes(mockRepository);
  });

  it('should list quotes with pagination', async () => {
    const mockQuotes = [
      { id: 'quote-1', quoteNumber: 'QTE-001', customerName: 'John Doe' },
      { id: 'quote-2', quoteNumber: 'QTE-002', customerName: 'Jane Smith' },
    ];

    mockRepository.findWithPagination.mockResolvedValue({
      data: mockQuotes,
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    } as any);

    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.hasMore).toBe(false);
  });

  it('should list quotes for specific customer', async () => {
    const mockQuotes = [{ id: 'quote-1', quoteNumber: 'QTE-001', customerId: 'customer-123' }];

    mockRepository.findByCustomerIdWithPagination.mockResolvedValue({
      data: mockQuotes as any,
      total: 1,
    });

    const result = await useCase.execute({ customerId: 'customer-123', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].customerId).toBe('customer-123');
    expect(mockRepository.findByCustomerIdWithPagination).toHaveBeenCalledWith(
      'customer-123',
      1,
      10,
    );
  });

  it('should filter by status', async () => {
    const mockQuotes = [
      { id: 'quote-1', status: QuoteStatus.SENT },
      { id: 'quote-2', status: QuoteStatus.PENDING },
    ];

    mockRepository.findWithPagination.mockResolvedValue({
      data: mockQuotes as any,
      total: 2,
    });

    const result = await useCase.execute({ status: QuoteStatus.SENT, page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe(QuoteStatus.SENT);
  });

  it('should handle empty result set', async () => {
    mockRepository.findWithPagination.mockResolvedValue({
      data: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    } as any);

    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should apply default page and limit values', async () => {
    mockRepository.findWithPagination.mockResolvedValue({
      data: [],
      total: 0,
    } as any);

    const result = await useCase.execute({});

    expect(mockRepository.findWithPagination).toHaveBeenCalledWith(1, 10);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should set hasMore when more records exist', async () => {
    mockRepository.findWithPagination.mockResolvedValue({
      data: [{ id: 'quote-1' }] as any,
      total: 30,
    });

    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.hasMore).toBe(true);
  });
});
