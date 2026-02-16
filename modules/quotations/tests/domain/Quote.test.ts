import { Quote, QuoteStatus, QuoteItem, BillingAddress, ShippingAddress } from '../../src/domain/entities/Quote';

describe('Quote Entity', () => {
  let quote: Quote;
  const mockItems: QuoteItem[] = [
    {
      id: '1',
      productId: 'prod-1',
      sku: 'SKU-001',
      productName: 'Product 1',
      quantity: 2,
      unitPrice: 100,
      lineTotal: 200,
    },
    {
      id: '2',
      productId: 'prod-2',
      sku: 'SKU-002',
      productName: 'Product 2',
      quantity: 1,
      unitPrice: 150,
      lineTotal: 150,
    },
  ];

  const mockBillingAddress: BillingAddress = {
    street: 'Str. Test 1',
    city: 'Bucharest',
    postcode: '010101',
    country: 'Romania',
  };

  const mockShippingAddress: ShippingAddress = {
    street: 'Str. Test 2',
    city: 'Bucharest',
    postcode: '010102',
    country: 'Romania',
  };

  beforeEach(() => {
    quote = new Quote(
      'quote-1',
      'QTE-20240101-0001',
      'customer-1',
      'John Doe',
      'john@example.com',
      mockItems,
      mockBillingAddress,
      mockShippingAddress,
      'Net 30',
      '5 business days',
      'user-1',
      10, // 10% discount
      15, // 15 days validity
      'Test notes',
    );
  });

  describe('calculateTotals', () => {
    test('should calculate subtotal correctly', () => {
      expect(quote.subtotal).toBe(350); // 200 + 150
    });

    test('should calculate discount amount correctly', () => {
      expect(quote.discountAmount).toBe(35); // 350 * 10%
    });

    test('should calculate tax amount correctly', () => {
      const subtotalAfterDiscount = 350 - 35; // 315
      const expectedTax = subtotalAfterDiscount * 0.21;
      expect(quote.taxAmount).toBeCloseTo(expectedTax, 2);
    });

    test('should calculate grand total correctly', () => {
      const subtotalAfterDiscount = 350 - 35; // 315
      const tax = subtotalAfterDiscount * 0.21;
      const expectedTotal = subtotalAfterDiscount + tax;
      expect(quote.grandTotal).toBeCloseTo(expectedTotal, 2);
    });

    test('should handle no discount', () => {
      const noDiscountQuote = new Quote(
        'quote-2',
        'QTE-20240101-0002',
        'customer-2',
        'Jane Doe',
        'jane@example.com',
        mockItems,
        mockBillingAddress,
        mockShippingAddress,
        'Net 30',
        '5 business days',
        'user-1',
        0, // No discount
      );

      expect(noDiscountQuote.discountAmount).toBe(0);
      expect(noDiscountQuote.subtotal).toBe(350);
    });
  });

  describe('send', () => {
    test('should transition from PENDING to SENT', () => {
      expect(quote.status).toBe(QuoteStatus.PENDING);
      quote.send();
      expect(quote.status).toBe(QuoteStatus.SENT);
      expect(quote.sentAt).not.toBeNull();
    });

    test('should throw error if not in PENDING state', () => {
      quote.send();
      expect(() => quote.send()).toThrow('Only pending quotes can be sent');
    });
  });

  describe('accept', () => {
    test('should transition from SENT to ACCEPTED', () => {
      quote.send();
      expect(quote.status).toBe(QuoteStatus.SENT);
      quote.accept();
      expect(quote.status).toBe(QuoteStatus.ACCEPTED);
      expect(quote.acceptedAt).not.toBeNull();
    });

    test('should throw error if not in SENT state', () => {
      expect(() => quote.accept()).toThrow('Only sent quotes can be accepted');
    });
  });

  describe('reject', () => {
    test('should transition from SENT to REJECTED', () => {
      quote.send();
      const reason = 'Price too high';
      quote.reject(reason);
      expect(quote.status).toBe(QuoteStatus.REJECTED);
      expect(quote.rejectionReason).toBe(reason);
      expect(quote.rejectedAt).not.toBeNull();
    });

    test('should throw error if not in SENT state', () => {
      expect(() => quote.reject('Some reason')).toThrow('Only sent quotes can be rejected');
    });
  });

  describe('expire', () => {
    test('should transition SENT quote to EXPIRED', () => {
      quote.send();
      quote.expire();
      expect(quote.status).toBe(QuoteStatus.EXPIRED);
    });

    test('should transition PENDING quote to EXPIRED', () => {
      quote.expire();
      expect(quote.status).toBe(QuoteStatus.EXPIRED);
    });

    test('should throw error from terminal states', () => {
      quote.send();
      quote.accept();
      expect(() => quote.expire()).toThrow('Cannot expire quotes in terminal states');
    });
  });

  describe('isExpired', () => {
    test('should return true if status is EXPIRED', () => {
      quote.send();
      quote.expire();
      expect(quote.isExpired()).toBe(true);
    });

    test('should return true if validUntil is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      quote.validUntil = pastDate;
      expect(quote.isExpired()).toBe(true);
    });

    test('should return false if quote is still valid', () => {
      expect(quote.isExpired()).toBe(false);
    });
  });

  describe('daysUntilExpiry', () => {
    test('should return approximately 15 days for new quote', () => {
      const daysLeft = quote.daysUntilExpiry();
      expect(daysLeft).toBeLessThanOrEqual(15);
      expect(daysLeft).toBeGreaterThan(14);
    });

    test('should return 0 or negative for expired quote', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      quote.validUntil = pastDate;
      expect(quote.daysUntilExpiry()).toBeLessThan(1);
    });
  });

  describe('needsReminder', () => {
    test('should return true when days until expiry matches reminder day', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      futureDate.setHours(12, 0, 0, 0);
      quote.validUntil = futureDate;
      quote.send();

      const daysLeft = quote.daysUntilExpiry();
      expect(quote.needsReminder(daysLeft)).toBe(true);
    });

    test('should return false for quotes in terminal states', () => {
      quote.send();
      quote.accept();
      expect(quote.needsReminder(5)).toBe(false);
    });

    test('should return false if days do not match', () => {
      quote.send();
      expect(quote.needsReminder(3)).toBe(false);
    });
  });

  describe('convertToOrderData', () => {
    test('should return valid order data', () => {
      const orderData = quote.convertToOrderData();

      expect(orderData.quoteId).toBe(quote.id);
      expect(orderData.quoteNumber).toBe(quote.quoteNumber);
      expect(orderData.customerId).toBe(quote.customerId);
      expect(orderData.items).toHaveLength(2);
      expect(orderData.subtotal).toBe(quote.subtotal);
      expect(orderData.grandTotal).toBe(quote.grandTotal);
    });

    test('should include all pricing information', () => {
      const orderData = quote.convertToOrderData();

      expect(orderData.discountAmount).toBe(quote.discountAmount);
      expect(orderData.discountPercentage).toBe(quote.discountPercentage);
      expect(orderData.taxAmount).toBe(quote.taxAmount);
      expect(orderData.currency).toBe(quote.currency);
    });
  });

  describe('generateQuoteNumber', () => {
    test('should generate quote number in correct format', () => {
      const quoteNumber = Quote.generateQuoteNumber();
      expect(quoteNumber).toMatch(/^QTE-\d{8}-\d{4}$/);
    });

    test('should generate unique quote numbers', () => {
      const numbers = new Set();
      for (let i = 0; i < 100; i++) {
        numbers.add(Quote.generateQuoteNumber());
      }
      // Should have at least 99 unique numbers (probability of collision is very low)
      expect(numbers.size).toBeGreaterThan(95);
    });
  });
});
