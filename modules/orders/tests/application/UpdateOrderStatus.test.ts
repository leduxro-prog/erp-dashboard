import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  IEventPublisher,
  IInvoiceService,
  IStockService,
  UpdateOrderStatus,
} from '../../src/application/use-cases/UpdateOrderStatus';
import { IOrderRepository, Order, OrderStatus, OrderItem, Address } from '../../src/domain';
import { InvalidStatusTransitionError, OrderCancellationError, OrderNotFoundError } from '../../src/application/errors';

const createOrder = (status: OrderStatus): Order =>
  Order.create({
    id: 10,
    orderNumber: 'ORD-20260213-0010',
    customerId: 100,
    customerName: 'Acme',
    customerEmail: 'acme@example.com',
    status,
    items: [
      OrderItem.create({
        id: 'item-1',
        productId: 1,
        sku: 'SKU-1',
        productName: 'Item 1',
        quantity: 2,
        unitPrice: 100,
      }),
    ],
    billingAddress: Address.create({
      name: 'Acme',
      street: 'Main 1',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010101',
    }),
    shippingAddress: Address.create({
      name: 'Acme',
      street: 'Ship 1',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010102',
    }),
    subtotal: 200,
    taxAmount: 38,
    shippingCost: 10,
    grandTotal: 248,
    paymentTerms: 'net_30',
    createdBy: 'seed',
    updatedBy: 'seed',
  });

describe('UpdateOrderStatus Use Case', () => {
  let useCase: UpdateOrderStatus;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockInvoiceService: jest.Mocked<IInvoiceService>;
  let mockStockService: jest.Mocked<IStockService>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockOrderRepository = {
      getById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    mockInvoiceService = {
      createInvoice: jest.fn(),
      createProforma: jest.fn(),
    } as jest.Mocked<IInvoiceService>;

    mockStockService = {
      releaseReservation: jest.fn(),
    } as jest.Mocked<IStockService>;

    mockEventPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    useCase = new UpdateOrderStatus(
      mockOrderRepository,
      mockInvoiceService,
      mockStockService,
      mockEventPublisher
    );
  });

  it('updates to quote_sent and publishes transition events', async () => {
    const order = createOrder(OrderStatus.QUOTE_PENDING);
    mockOrderRepository.getById.mockResolvedValue(order);

    await useCase.execute({
      orderId: order.id,
      newStatus: OrderStatus.QUOTE_SENT,
      changedBy: 'agent-1',
    });

    expect(order.status).toBe(OrderStatus.QUOTE_SENT);
    expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
    const eventTypes = mockEventPublisher.publish.mock.calls.map((call) => call[0].type);
    expect(eventTypes).toContain('order.quote_sent');
    expect(eventTypes).toContain('order.status_changed');
  });

  it('creates invoice when transitioning to shipped', async () => {
    const order = createOrder(OrderStatus.READY_TO_SHIP);
    mockOrderRepository.getById.mockResolvedValue(order);
    mockInvoiceService.createInvoice.mockResolvedValue('INV-100');

    await useCase.execute({
      orderId: order.id,
      newStatus: OrderStatus.SHIPPED,
      changedBy: 'warehouse-1',
    });

    expect(mockInvoiceService.createInvoice).toHaveBeenCalledWith(order.id, expect.any(Date));
    expect(order.invoiceNumber).toBe('INV-100');
    expect(order.paymentStatus).toBe('pending');
  });

  it('releases stock when cancelling an order', async () => {
    const order = createOrder(OrderStatus.ORDER_CONFIRMED);
    mockOrderRepository.getById.mockResolvedValue(order);

    await useCase.execute({
      orderId: order.id,
      newStatus: OrderStatus.CANCELLED,
      changedBy: 'manager-1',
      notes: 'Customer requested cancellation',
    });

    expect(mockStockService.releaseReservation).toHaveBeenCalledWith(order.id);
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it('throws when transition is invalid', async () => {
    const order = createOrder(OrderStatus.QUOTE_PENDING);
    mockOrderRepository.getById.mockResolvedValue(order);

    await expect(
      useCase.execute({
        orderId: order.id,
        newStatus: OrderStatus.DELIVERED,
        changedBy: 'user-1',
      })
    ).rejects.toThrow(InvalidStatusTransitionError);
    expect(mockOrderRepository.update).not.toHaveBeenCalled();
  });

  it('throws OrderNotFoundError for missing order', async () => {
    mockOrderRepository.getById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        orderId: 404,
        newStatus: OrderStatus.QUOTE_SENT,
        changedBy: 'user-1',
      })
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('throws cancellation error when stock release fails', async () => {
    const order = createOrder(OrderStatus.ORDER_CONFIRMED);
    mockOrderRepository.getById.mockResolvedValue(order);
    mockStockService.releaseReservation.mockRejectedValue(new Error('stock offline'));

    await expect(
      useCase.execute({
        orderId: order.id,
        newStatus: OrderStatus.CANCELLED,
        changedBy: 'user-1',
        notes: 'Manual cancel',
      })
    ).rejects.toThrow(OrderCancellationError);
  });
});
