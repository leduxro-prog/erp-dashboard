import { ConvertToOrder, IOrderService, IEventPublisher } from '../../src/application/use-cases/ConvertToOrder';
import { Quote, QuoteStatus } from '../../src/domain/entities/Quote';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { QuoteNotFoundError, QuoteAlreadyProcessedError } from '../../src/application/errors/QuoteErrors';

describe('ConvertToOrder Use Case', () => {
  let convertToOrder: ConvertToOrder;
  let mockRepository: jest.Mocked<IQuoteRepository>;
  let mockOrderService: jest.Mocked<IOrderService>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByQuoteNumber: jest.fn(),
      findByCustomerId: jest.fn(),
      findAll: jest.fn(),
      findByStatus: jest.fn(),
      findExpiredQuotes: jest.fn(),
      findQuotesByExpirationDate: jest.fn(),
      findPendingOrSentQuotes: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countByCustomerId: jest.fn(),
      findWithPagination: jest.fn(),
      findByCustomerIdWithPagination: jest.fn(),
    };

    mockOrderService = {
      createOrder: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn(),
    };

    convertToOrder = new ConvertToOrder(mockRepository, mockOrderService, mockEventPublisher);
  });

  describe('execute', () => {
    test('should convert accepted quote to order', async () => {
      const quote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        'customer-1',
        'John Doe',
        'john@example.com',
        [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
          },
        ],
        {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        'Net 30',
        '5 business days',
        'user-1',
      );

      quote.send();
      quote.accept();

      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-20240101-0001',
        quoteId: quote.id,
      };

      mockRepository.findById.mockResolvedValue(quote);
      mockOrderService.createOrder.mockResolvedValue(mockOrder);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await convertToOrder.execute('quote-1');

      expect(result).toEqual(mockOrder);
      expect(mockOrderService.createOrder).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('quote_converted_to_order', expect.objectContaining({
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        orderId: 'order-1',
      }));
    });

    test('should throw error if quote not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(convertToOrder.execute('non-existent')).rejects.toThrow(QuoteNotFoundError);
      expect(mockOrderService.createOrder).not.toHaveBeenCalled();
    });

    test('should throw error if quote is not accepted', async () => {
      const quote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        'customer-1',
        'John Doe',
        'john@example.com',
        [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
          },
        ],
        {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        'Net 30',
        '5 business days',
        'user-1',
      );

      quote.send();

      mockRepository.findById.mockResolvedValue(quote);

      await expect(convertToOrder.execute('quote-1')).rejects.toThrow(QuoteAlreadyProcessedError);
      expect(mockOrderService.createOrder).not.toHaveBeenCalled();
    });

    test('should throw error if quote is in PENDING state', async () => {
      const quote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        'customer-1',
        'John Doe',
        'john@example.com',
        [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
          },
        ],
        {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        'Net 30',
        '5 business days',
        'user-1',
      );

      mockRepository.findById.mockResolvedValue(quote);

      await expect(convertToOrder.execute('quote-1')).rejects.toThrow(QuoteAlreadyProcessedError);
    });

    test('should publish event with correct data', async () => {
      const quote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        'customer-1',
        'John Doe',
        'john@example.com',
        [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
          },
        ],
        {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        'Net 30',
        '5 business days',
        'user-1',
      );

      quote.send();
      quote.accept();

      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-20240101-0001',
      };

      mockRepository.findById.mockResolvedValue(quote);
      mockOrderService.createOrder.mockResolvedValue(mockOrder);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      await convertToOrder.execute('quote-1');

      const publishCall = mockEventPublisher.publish.mock.calls[0];
      expect(publishCall[0]).toBe('quote_converted_to_order');
      expect(publishCall[1]).toHaveProperty('quoteId', 'quote-1');
      expect(publishCall[1]).toHaveProperty('quoteNumber', 'QTE-20240101-0001');
      expect(publishCall[1]).toHaveProperty('orderId', 'order-1');
      expect(publishCall[1]).toHaveProperty('timestamp');
    });
  });
});
