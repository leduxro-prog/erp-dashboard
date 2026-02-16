/**
 * ConvertCartToOrder Use Case
 * Converts a saved cart to an actual order.
 *
 * @module B2B Portal - Application
 */

import { SavedCart } from '../../domain/entities/SavedCart';
import { B2BCustomer } from '../../domain/entities/B2BCustomer';
import { CreditTransaction } from '../../domain/entities/CreditTransaction';
import { ISavedCartRepository } from '../../domain/repositories/ISavedCartRepository';
import { IB2BCustomerRepository } from '../../domain/repositories/IB2BCustomerRepository';
import { ICreditTransactionRepository } from '../../domain/repositories/ICreditTransactionRepository';
import { CartNotFoundError, EmptyCartError } from '../../domain/errors/b2b.errors';
import { NotFoundError } from '@shared/errors/BaseError';
import { CreditService } from '../../domain/services/CreditService';
import { IOrderPort } from '../ports';

/**
 * Input DTO
 */
export interface ConvertCartToOrderInput {
  cartId: string;
  customerId: string;
  notes?: string;
  userId: string;
}

/**
 * Output DTO
 */
export interface ConvertCartToOrderOutput {
  orderId: string;
  cartId: string;
  customerId: string;
  totalAmount: number;
  creditUsed: number;
  message: string;
}

/**
 * ConvertCartToOrder Use Case
 *
 * Implements the business logic for cart conversion:
 * 1. Load cart and customer
 * 2. Validate cart is not empty
 * 3. Validate customer has sufficient credit
 * 4. Create order via external port
 * 5. Use credit and record transaction
 * 6. Clear/archive cart
 * 7. Publish event
 *
 * @class ConvertCartToOrder
 */
export class ConvertCartToOrder {
  /**
   * Create a new ConvertCartToOrder use case.
   *
   * @param cartRepository - Saved cart repository
   * @param customerRepository - Customer repository
   * @param transactionRepository - Credit transaction repository
   * @param orderPort - External order service port
   * @param creditService - Credit management service
   * @param eventPublisher - Event publisher callback
   */
  constructor(
    private readonly cartRepository: ISavedCartRepository,
    private readonly customerRepository: IB2BCustomerRepository,
    private readonly transactionRepository: ICreditTransactionRepository,
    private readonly orderPort: IOrderPort,
    private readonly creditService: CreditService,
    private readonly eventPublisher: (event: string, data: unknown) => Promise<void>
  ) { }

  /**
   * Execute the use case.
   *
   * @param input - Conversion input
   * @returns Conversion output
   * @throws {CartNotFoundError} If cart not found
   * @throws {EmptyCartError} If cart is empty
   * @throws {NotFoundError} If customer not found
   * @throws {InsufficientCreditError} If insufficient credit
   */
  async execute(input: ConvertCartToOrderInput): Promise<ConvertCartToOrderOutput> {
    // Load cart
    const cart = await this.cartRepository.findById(input.cartId);
    if (!cart) {
      throw new CartNotFoundError(input.cartId);
    }

    // Verify cart belongs to customer
    if (cart.customerId !== input.customerId) {
      throw new CartNotFoundError(input.cartId);
    }

    // Validate cart is not empty
    if (cart.isEmpty()) {
      throw new EmptyCartError(input.cartId);
    }

    // Load customer
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new NotFoundError('B2B Customer', input.customerId);
    }

    // Get order items from cart
    const orderItems = cart.convertToOrder();

    // Validate customer has sufficient credit
    this.creditService.validateSufficientCredit(customer, cart.subtotal);

    // Create order via external port
    const orderResult = await this.orderPort.createOrder({
      customerId: input.customerId,
      items: orderItems,
      notes: input.notes || `Converted from saved cart: ${cart.name}`,
    });

    // Use credit and create transaction
    const transaction = this.creditService.useCredit(
      customer,
      orderResult.totalAmount,
      orderResult.id,
      input.userId
    );

    // Save customer with updated credit
    await this.customerRepository.save(customer);

    // Save credit transaction
    await this.transactionRepository.save(transaction);

    // Record order in customer (for statistics)
    customer.recordOrder(orderResult.totalAmount);
    await this.customerRepository.save(customer);

    // Clear cart (or mark as converted)
    cart.clear();
    await this.cartRepository.save(cart);

    // Publish event
    await this.eventPublisher('b2b.order_from_cart', {
      orderId: orderResult.id,
      cartId: input.cartId,
      customerId: input.customerId,
      totalAmount: orderResult.totalAmount,
      creditUsed: orderResult.totalAmount,
      itemCount: orderItems.length,
    });

    return {
      orderId: orderResult.id,
      cartId: input.cartId,
      customerId: input.customerId,
      totalAmount: orderResult.totalAmount,
      creditUsed: orderResult.totalAmount,
      message: `Order ${orderResult.id} created successfully. Credit used: ${orderResult.totalAmount}`,
    };
  }
}
