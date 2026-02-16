import { CreateQuote } from '../../src/application/use-cases/CreateQuote';
import { CreateQuoteDTO } from '../../src/application/dtos/CreateQuoteDTO';
import { IQuoteRepository } from '../../src/domain/repositories/IQuoteRepository';
import { InvalidQuoteItemsError } from '../../src/application/errors/QuoteErrors';
import { Quote } from '../../src/domain/entities/Quote';

describe('CreateQuote Use Case', () => {
  let createQuote: CreateQuote;
  let mockRepository: jest.Mocked<IQuoteRepository>;

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

    createQuote = new CreateQuote(mockRepository);
  });

  describe('execute', () => {
    test('should create a quote with valid data', async () => {
      const dto: CreateQuoteDTO = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 2,
            unitPrice: 100,
          },
        ],
        billingAddress: {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        shippingAddress: {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        paymentTerms: 'Net 30',
        deliveryEstimate: '5 business days',
        createdBy: 'user-1',
        discountPercentage: 10,
        validityDays: 15,
      };

      const mockQuote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        dto.customerId,
        dto.customerName,
        dto.customerEmail,
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
        dto.billingAddress,
        dto.shippingAddress,
        dto.paymentTerms,
        dto.deliveryEstimate,
        dto.createdBy,
        dto.discountPercentage,
        dto.validityDays,
      );

      mockRepository.save.mockResolvedValue(mockQuote);

      const result = await createQuote.execute(dto);

      expect(result).toBeDefined();
      expect(result.customerId).toBe(dto.customerId);
      expect(result.customerName).toBe(dto.customerName);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    test('should throw error if items array is empty', async () => {
      const dto: CreateQuoteDTO = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [],
        billingAddress: {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        shippingAddress: {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        paymentTerms: 'Net 30',
        deliveryEstimate: '5 business days',
        createdBy: 'user-1',
      };

      await expect(createQuote.execute(dto)).rejects.toThrow(InvalidQuoteItemsError);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    test('should throw error if items is undefined', async () => {
      const dto: any = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: undefined,
        billingAddress: {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        shippingAddress: {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        paymentTerms: 'Net 30',
        deliveryEstimate: '5 business days',
        createdBy: 'user-1',
      };

      await expect(createQuote.execute(dto)).rejects.toThrow(InvalidQuoteItemsError);
    });

    test('should use default values for optional fields', async () => {
      const dto: CreateQuoteDTO = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        billingAddress: {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        shippingAddress: {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        paymentTerms: 'Net 30',
        deliveryEstimate: '5 business days',
        createdBy: 'user-1',
      };

      const mockQuote = new Quote(
        'quote-1',
        'QTE-20240101-0001',
        dto.customerId,
        dto.customerName,
        dto.customerEmail,
        [
          {
            id: 'item-1',
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
          },
        ],
        dto.billingAddress,
        dto.shippingAddress,
        dto.paymentTerms,
        dto.deliveryEstimate,
        dto.createdBy,
      );

      mockRepository.save.mockResolvedValue(mockQuote);

      const result = await createQuote.execute(dto);

      expect(result.discountPercentage).toBe(0);
      expect(result.validityDays).toBe(15);
    });

    test('should create unique quote numbers', async () => {
      const randomSpy = jest.spyOn(Math, 'random');
      randomSpy.mockReturnValueOnce(0.1111).mockReturnValueOnce(0.2222);

      const baseDto: CreateQuoteDTO = {
        customerId: 'customer-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU-001',
            productName: 'Product 1',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        billingAddress: {
          street: 'Str. Test 1',
          city: 'Bucharest',
          postcode: '010101',
          country: 'Romania',
        },
        shippingAddress: {
          street: 'Str. Test 2',
          city: 'Bucharest',
          postcode: '010102',
          country: 'Romania',
        },
        paymentTerms: 'Net 30',
        deliveryEstimate: '5 business days',
        createdBy: 'user-1',
      };

      mockRepository.save.mockImplementation(async quote => quote);

      const quote1 = await createQuote.execute(baseDto);
      const quote2 = await createQuote.execute(baseDto);

      expect(quote1.quoteNumber).not.toBe(quote2.quoteNumber);

      randomSpy.mockRestore();
    });
  });
});
