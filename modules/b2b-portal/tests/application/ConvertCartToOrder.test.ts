/**
 * ConvertCartToOrder Use Case Tests
 * Tests cart conversion with credit validation and order creation
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ConvertCartToOrder,
  ConvertCartToOrderInput,
} from '../../src/application/use-cases/ConvertCartToOrder';
import { CartNotFoundError, EmptyCartError } from '../../src/domain/errors/b2b.errors';

describe('ConvertCartToOrder Use Case', () => {
  let useCase: ConvertCartToOrder;
  let mockCartRepository: any;
  let mockCustomerRepository: any;
  let mockTransactionRepository: any;
  let mockOrderPort: any;
  let mockCreditService: any;
  let mockEventPublisher: jest.MockedFunction<(event: string, data: unknown) => Promise<void>>;

  beforeEach(() => {
    mockCartRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockCustomerRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    mockTransactionRepository = {
      save: jest.fn(),
    };

    mockOrderPort = {
      createOrder: jest.fn(),
    };

    mockCreditService = {
      validateSufficientCredit: jest.fn(),
      useCredit: jest.fn(),
    };

    mockEventPublisher = jest.fn(async () => undefined);

    useCase = new ConvertCartToOrder(
      mockCartRepository,
      mockCustomerRepository,
      mockTransactionRepository,
      mockOrderPort,
      mockCreditService,
      mockEventPublisher
    );
  });

  describe('Happy Path - Cart Conversion', () => {
    it('should convert cart to order successfully', async () => {
      const cart = createMockCart('cart-001', 'cust-001', 5000);
      const customer = createMockCustomer('cust-001', 20000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-001',
        customerId: 'cust-001',
        userId: 'user-001',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-001',
        totalAmount: 5000,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-001',
        customerId: 'cust-001',
        orderId: 'ord-001',
        amount: 5000,
      });

      const result = await useCase.execute(input);

      expect(result.orderId).toBe('ord-001');
      expect(result.cartId).toBe('cart-001');
      expect(result.customerId).toBe('cust-001');
      expect(result.totalAmount).toBe(5000);
      expect(result.creditUsed).toBe(5000);
      expect(mockOrderPort.createOrder).toHaveBeenCalled();
      expect(mockEventPublisher).toHaveBeenCalledWith('b2b.order_from_cart', expect.any(Object));
    });

    it('should validate sufficient credit before creating order', async () => {
      const cart = createMockCart('cart-002', 'cust-002', 3000);
      const customer = createMockCustomer('cust-002', 50000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-002',
        customerId: 'cust-002',
        userId: 'user-002',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-002',
        totalAmount: 3000,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-002',
        customerId: 'cust-002',
        orderId: 'ord-002',
        amount: 3000,
      });

      const result = await useCase.execute(input);

      expect(mockCreditService.validateSufficientCredit).toHaveBeenCalledWith(customer, 3000);
      expect(result.orderId).toBe('ord-002');
    });

    it('should create order with correct items from cart', async () => {
      const orderItems = [
        { productId: 'prod-001', quantity: 5, unitPrice: 100 },
        { productId: 'prod-002', quantity: 3, unitPrice: 200 },
      ];
      const cart = createMockCart('cart-003', 'cust-003', 1100);
      cart.convertToOrder = jest.fn().mockReturnValue(orderItems);

      const customer = createMockCustomer('cust-003', 10000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-003',
        customerId: 'cust-003',
        userId: 'user-003',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-003',
        totalAmount: 1100,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-003',
        customerId: 'cust-003',
        orderId: 'ord-003',
        amount: 1100,
      });

      await useCase.execute(input);

      expect(mockOrderPort.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-003',
          items: orderItems,
        })
      );
    });

    it('should record order in customer statistics', async () => {
      const cart = createMockCart('cart-004', 'cust-004', 2500);
      const customer = createMockCustomer('cust-004', 30000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-004',
        customerId: 'cust-004',
        userId: 'user-004',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-004',
        totalAmount: 2500,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-004',
        customerId: 'cust-004',
        orderId: 'ord-004',
        amount: 2500,
      });

      await useCase.execute(input);

      expect(customer.recordOrder).toHaveBeenCalledWith(2500);
      expect(mockCustomerRepository.save).toHaveBeenCalledWith(customer);
    });

    it('should clear cart after successful conversion', async () => {
      const cart = createMockCart('cart-005', 'cust-005', 1500);
      const customer = createMockCustomer('cust-005', 25000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-005',
        customerId: 'cust-005',
        userId: 'user-005',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-005',
        totalAmount: 1500,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-005',
        customerId: 'cust-005',
        orderId: 'ord-005',
        amount: 1500,
      });

      await useCase.execute(input);

      expect(cart.clear).toHaveBeenCalled();
      expect(mockCartRepository.save).toHaveBeenCalledWith(cart);
    });

    it('should save credit transaction', async () => {
      const cart = createMockCart('cart-006', 'cust-006', 4000);
      const customer = createMockCustomer('cust-006', 15000);

      const transaction = {
        id: 'trans-006',
        customerId: 'cust-006',
        orderId: 'ord-006',
        amount: 4000,
      };

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-006',
        customerId: 'cust-006',
        userId: 'user-006',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-006',
        totalAmount: 4000,
      });
      mockCreditService.useCredit.mockReturnValue(transaction);

      await useCase.execute(input);

      expect(mockTransactionRepository.save).toHaveBeenCalledWith(transaction);
    });

    it('should publish order event with correct payload', async () => {
      const cart = createMockCart('cart-007', 'cust-007', 3500);
      cart.convertToOrder = jest.fn().mockReturnValue([
        { productId: 'prod-001', quantity: 5, unitPrice: 700 },
      ]);
      const customer = createMockCustomer('cust-007', 20000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-007',
        customerId: 'cust-007',
        userId: 'user-007',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-007',
        totalAmount: 3500,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-007',
        customerId: 'cust-007',
        orderId: 'ord-007',
        amount: 3500,
      });

      await useCase.execute(input);

      expect(mockEventPublisher).toHaveBeenCalledWith(
        'b2b.order_from_cart',
        expect.objectContaining({
          orderId: 'ord-007',
          cartId: 'cart-007',
          customerId: 'cust-007',
          totalAmount: 3500,
          creditUsed: 3500,
          itemCount: 1,
        })
      );
    });
  });

  describe('Error Cases - Cart Validation', () => {
    it('should throw CartNotFoundError when cart does not exist', async () => {
      const input: ConvertCartToOrderInput = {
        cartId: 'cart-nonexistent',
        customerId: 'cust-001',
        userId: 'user-001',
      };

      mockCartRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(CartNotFoundError);
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });

    it('should throw CartNotFoundError when cart belongs to different customer', async () => {
      const cart = createMockCart('cart-008', 'cust-other', 5000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-008',
        customerId: 'cust-001',
        userId: 'user-001',
      };

      mockCartRepository.findById.mockResolvedValue(cart);

      await expect(useCase.execute(input)).rejects.toThrow(CartNotFoundError);
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });

    it('should throw EmptyCartError when cart has no items', async () => {
      const cart = createMockCart('cart-009', 'cust-009', 0);
      cart.isEmpty = jest.fn().mockReturnValue(true);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-009',
        customerId: 'cust-009',
        userId: 'user-009',
      };

      mockCartRepository.findById.mockResolvedValue(cart);

      await expect(useCase.execute(input)).rejects.toThrow(EmptyCartError);
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });

    it('should validate cart belongs to customer before processing', async () => {
      const cart = createMockCart('cart-010', 'cust-different', 5000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-010',
        customerId: 'cust-010',
        userId: 'user-010',
      };

      mockCartRepository.findById.mockResolvedValue(cart);

      await expect(useCase.execute(input)).rejects.toThrow(CartNotFoundError);
      expect(mockCustomerRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('Error Cases - Credit Validation', () => {
    it('should throw InsufficientCreditError when customer has insufficient credit', async () => {
      const cart = createMockCart('cart-011', 'cust-011', 50000);
      const customer = createMockCustomer('cust-011', 5000); // Only 5000 credit

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-011',
        customerId: 'cust-011',
        userId: 'user-011',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockCreditService.validateSufficientCredit.mockImplementation(() => {
        throw new Error('Insufficient credit');
      });

      await expect(useCase.execute(input)).rejects.toThrow('Insufficient credit');
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });

    it('should not create order if credit validation fails', async () => {
      const cart = createMockCart('cart-012', 'cust-012', 25000);
      const customer = createMockCustomer('cust-012', 10000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-012',
        customerId: 'cust-012',
        userId: 'user-012',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockCreditService.validateSufficientCredit.mockImplementation(() => {
        throw new Error('Credit check failed');
      });

      await expect(useCase.execute(input)).rejects.toThrow();
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('Error Cases - Customer Validation', () => {
    it('should throw NotFoundError when customer does not exist', async () => {
      const cart = createMockCart('cart-013', 'cust-013', 5000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-013',
        customerId: 'cust-013',
        userId: 'user-013',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow();
      expect(mockOrderPort.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero subtotal cart', async () => {
      const cart = createMockCart('cart-014', 'cust-014', 0);
      const customer = createMockCustomer('cust-014', 10000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-014',
        customerId: 'cust-014',
        userId: 'user-014',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-014',
        totalAmount: 0,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-014',
        customerId: 'cust-014',
        orderId: 'ord-014',
        amount: 0,
      });

      const result = await useCase.execute(input);

      expect(result.totalAmount).toBe(0);
      expect(result.creditUsed).toBe(0);
    });

    it('should handle cart with notes', async () => {
      const cart = createMockCart('cart-015', 'cust-015', 2000);
      cart.name = 'Special Order Cart';
      const customer = createMockCustomer('cust-015', 15000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-015',
        customerId: 'cust-015',
        userId: 'user-015',
        notes: 'Custom delivery instructions',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-015',
        totalAmount: 2000,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-015',
        customerId: 'cust-015',
        orderId: 'ord-015',
        amount: 2000,
      });

      await useCase.execute(input);

      expect(mockOrderPort.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Custom delivery instructions',
        })
      );
    });

    it('should use default notes when not provided', async () => {
      const cart = createMockCart('cart-016', 'cust-016', 3000);
      cart.name = 'Regular Cart';
      const customer = createMockCustomer('cust-016', 20000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-016',
        customerId: 'cust-016',
        userId: 'user-016',
        // No notes provided
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-016',
        totalAmount: 3000,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-016',
        customerId: 'cust-016',
        orderId: 'ord-016',
        amount: 3000,
      });

      await useCase.execute(input);

      expect(mockOrderPort.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.stringContaining('Converted from saved cart'),
        })
      );
    });

    it('should handle large order amounts', async () => {
      const largeAmount = 1000000;
      const cart = createMockCart('cart-017', 'cust-017', largeAmount);
      const customer = createMockCustomer('cust-017', 2000000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-017',
        customerId: 'cust-017',
        userId: 'user-017',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-017',
        totalAmount: largeAmount,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-017',
        customerId: 'cust-017',
        orderId: 'ord-017',
        amount: largeAmount,
      });

      const result = await useCase.execute(input);

      expect(result.totalAmount).toBe(largeAmount);
      expect(result.creditUsed).toBe(largeAmount);
    });

    it('should handle customer with exact credit amount', async () => {
      const amount = 5000;
      const cart = createMockCart('cart-018', 'cust-018', amount);
      const customer = createMockCustomer('cust-018', amount); // Exact match

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-018',
        customerId: 'cust-018',
        userId: 'user-018',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-018',
        totalAmount: amount,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-018',
        customerId: 'cust-018',
        orderId: 'ord-018',
        amount,
      });

      const result = await useCase.execute(input);

      expect(result.creditUsed).toBe(amount);
      expect(mockEventPublisher).toHaveBeenCalled();
    });

    it('should update customer in repositories after processing', async () => {
      const cart = createMockCart('cart-019', 'cust-019', 2500);
      const customer = createMockCustomer('cust-019', 30000);

      const input: ConvertCartToOrderInput = {
        cartId: 'cart-019',
        customerId: 'cust-019',
        userId: 'user-019',
      };

      mockCartRepository.findById.mockResolvedValue(cart);
      mockCustomerRepository.findById.mockResolvedValue(customer);
      mockOrderPort.createOrder.mockResolvedValue({
        id: 'ord-019',
        totalAmount: 2500,
      });
      mockCreditService.useCredit.mockReturnValue({
        id: 'trans-019',
        customerId: 'cust-019',
        orderId: 'ord-019',
        amount: 2500,
      });

      await useCase.execute(input);

      // Customer should be saved twice: once for credit, once for order record
      expect(mockCustomerRepository.save).toHaveBeenCalledTimes(2);
    });
  });
});

// Helper function to create mock cart
function createMockCart(id: string, customerId: string, subtotal: number): any {
  return {
    id,
    customerId,
    subtotal,
    isEmpty: jest.fn().mockReturnValue(false),
    convertToOrder: jest.fn().mockReturnValue([
      { productId: 'prod-001', quantity: 1, unitPrice: subtotal },
    ]),
    clear: jest.fn(),
    name: `Cart ${id}`,
  };
}

// Helper function to create mock customer
function createMockCustomer(id: string, availableCredit: number): any {
  return {
    id,
    availableCredit,
    recordOrder: jest.fn(),
  };
}
