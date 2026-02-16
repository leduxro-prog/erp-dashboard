/**
 * Create Order Use Case
 * Creates a new order with validation, stock reservation, and event publishing
 */
import {
  Order,
  OrderItem,
  OrderStatus,
  Address,
  OrderCalculationService,
  IOrderRepository,
} from '../../domain';
import { CreateOrderInput, OrderResult, CreateOrderItemInput } from '../dtos';
import {
  OrderNotFoundError,
  InvalidOrderInputError,
  InsufficientStockError,
  StockReservationError,
} from '../errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event publisher interface for domain events
 */
export interface IEventPublisher {
  publish(event: any): Promise<void>;
}

/**
 * Stock service interface for checking availability
 */
export interface IStockService {
  checkAvailability(
    productId: number,
    quantity: number,
  ): Promise<{ available: boolean; quantity: number }>;
  reserveStock(
    orderId: number,
    items: Array<{ productId: number; quantity: number }>,
  ): Promise<void>;
}

/**
 * Product service interface for fetching product details
 */
export interface IProductService {
  getProduct(productId: number): Promise<{
    id: number;
    sku: string;
    name: string;
    price: number;
    costPrice?: number | null;
    costSource?: string | null;
  } | null>;
  getProducts(productIds: number[]): Promise<
    Array<{
      id: number;
      sku: string;
      name: string;
      price: number;
      costPrice?: number | null;
      costSource?: string | null;
    }>
  >;
}

export class CreateOrder {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly stockService: IStockService,
    private readonly productService: IProductService,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(input: CreateOrderInput): Promise<OrderResult> {
    // Validate input
    this.validateInput(input);

    // Fetch product details
    const productIds = input.items.map((item) => item.productId);
    const products = await this.productService.getProducts(productIds);

    if (products.length !== productIds.length) {
      throw new InvalidOrderInputError('One or more products not found');
    }

    // Check stock availability
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new InvalidOrderInputError(`Product ${item.productId} not found`);
      }

      const availability = await this.stockService.checkAvailability(item.productId, item.quantity);

      if (!availability.available) {
        throw new InsufficientStockError(item.productId, item.quantity, availability.quantity);
      }
    }

    // Create order items from product data with cost snapshot
    const orderItems: OrderItem[] = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new InvalidOrderInputError(`Product ${item.productId} not found`);
      }

      return OrderItem.create({
        id: uuidv4(),
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        costPriceSnapshot: product.costPrice ?? null,
        costSource: (product.costSource as any) ?? null,
      });
    });

    // Calculate totals
    const totals = OrderCalculationService.calculateOrderTotals(
      orderItems,
      input.discountAmount,
      input.shippingCost,
    );

    // Create address objects
    const billingAddress = Address.create(input.billingAddress);
    const shippingAddress = Address.create(input.shippingAddress);

    // Generate order number
    const nextOrderNumber = await this.orderRepository.getNextOrderNumber();

    // Create order entity
    const order = Order.create({
      id: 0, // Will be assigned by repository
      orderNumber: nextOrderNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      status: OrderStatus.QUOTE_PENDING,
      items: orderItems,
      billingAddress,
      shippingAddress,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      shippingCost: totals.shippingCost,
      grandTotal: totals.grandTotal,
      paymentTerms: input.paymentTerms,
      paymentStatus: 'pending',
      notes: input.notes,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    // Save order to repository
    const savedOrder = await this.orderRepository.create(order);

    // Reserve stock (publish event for asynchronous processing)
    try {
      await this.stockService.reserveStock(
        savedOrder.id,
        input.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      );
    } catch (error) {
      // If stock reservation fails, the order might be left in an inconsistent state
      // In production, consider implementing a compensating transaction
      throw new StockReservationError(
        `Failed to reserve stock for order ${savedOrder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Publish order created event
    await this.eventPublisher.publish({
      type: 'order.created',
      orderId: savedOrder.id,
      orderNumber: savedOrder.orderNumber,
      customerId: savedOrder.customerId,
      items: savedOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      grandTotal: savedOrder.grandTotal,
      timestamp: new Date(),
    });

    return this.mapOrderToResult(savedOrder);
  }

  private validateInput(input: CreateOrderInput): void {
    if (!input.customerId || input.customerId <= 0) {
      throw new InvalidOrderInputError('Valid customer ID is required');
    }

    if (!input.customerName || input.customerName.trim().length === 0) {
      throw new InvalidOrderInputError('Customer name is required');
    }

    if (!input.customerEmail || input.customerEmail.trim().length === 0) {
      throw new InvalidOrderInputError('Customer email is required');
    }

    if (!input.items || input.items.length === 0) {
      throw new InvalidOrderInputError('At least one order item is required');
    }

    for (const item of input.items) {
      if (item.productId <= 0) {
        throw new InvalidOrderInputError('Valid product ID is required');
      }

      if (item.quantity <= 0) {
        throw new InvalidOrderInputError('Item quantity must be greater than 0');
      }
    }

    if (
      input.discountAmount &&
      (input.discountAmount < 0 || !Number.isFinite(input.discountAmount))
    ) {
      throw new InvalidOrderInputError('Discount amount must be a valid number');
    }

    if (input.shippingCost && (input.shippingCost < 0 || !Number.isFinite(input.shippingCost))) {
      throw new InvalidOrderInputError('Shipping cost must be a valid number');
    }
  }

  private mapOrderToResult(order: Order): OrderResult {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        quantityDelivered: item.quantityDelivered,
        quantityRemaining: item.quantityRemaining,
        lineTotal: item.getLineTotal(),
        sourceWarehouseId: item.sourceWarehouseId,
        costPriceSnapshot: item.costPriceSnapshot,
        costSource: item.costSource,
        grossProfit: item.getGrossProfit(),
        grossMarginPercent: item.getGrossMarginPercent(),
      })),
      billingAddress: order.billingAddress.toJSON(),
      shippingAddress: order.shippingAddress.toJSON(),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      shippingCost: order.shippingCost,
      grandTotal: order.grandTotal,
      currency: order.currency,
      taxRate: order.taxRate,
      paymentTerms: order.paymentTerms,
      paymentStatus: order.paymentStatus,
      proformaNumber: order.proformaNumber,
      invoiceNumber: order.invoiceNumber,
      notes: order.notes,
      statusHistory: order.statusHistory.map((s) => ({
        fromStatus: s.fromStatus,
        toStatus: s.toStatus,
        changedBy: s.changedBy,
        changedAt: s.changedAt.toISOString(),
        notes: s.notes,
      })),
      createdBy: order.createdBy,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      updatedBy: order.updatedBy,
    };
  }
}
