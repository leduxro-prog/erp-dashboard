import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CancelOrder,
  IEventPublisher,
  IStockService,
} from '../../src/application/use-cases/CancelOrder';
import { IOrderRepository, Order, OrderItem, OrderStatus, Address } from '../../src/domain';
import { OrderCancellationError, OrderNotFoundError } from '../../src/application/errors';

const makeOrder = (status: OrderStatus = OrderStatus.QUOTE_PENDING): Order =>
  Order.create({
    id: 1,
    orderNumber: 'ORD-001',
    customerId: 123,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    status,
    items: [
      OrderItem.create({
        id: 'item-1',
        productId: 1,
        sku: 'SKU-1',
        productName: 'Product 1',
        quantity: 1,
        unitPrice: 100,
      }),
    ],
    billingAddress: Address.create({
      name: 'John Doe',
      street: 'Main',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010101',
    }),
    shippingAddress: Address.create({
      name: 'John Doe',
      street: 'Ship',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010102',
    }),
    subtotal: 100,
    taxAmount: 19,
    shippingCost: 0,
    grandTotal: 119,
    paymentTerms: 'net_30',
    createdBy: 'seed',
    updatedBy: 'seed',
  });

describe('CancelOrder Use Case', () => {
  let useCase: CancelOrder;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockStockService: jest.Mocked<IStockService>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockOrderRepository = {
      getById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    mockStockService = {
      releaseReservation: jest.fn(),
    } as jest.Mocked<IStockService>;

    mockEventPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    useCase = new CancelOrder(mockOrderRepository, mockStockService, mockEventPublisher);
  });

  it('cancels order, releases stock, and persists changes', async () => {
    const order = makeOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    await useCase.execute({ orderId: 1, reason: 'Customer requested', cancelledBy: 'user-1' });

    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(mockStockService.releaseReservation).toHaveBeenCalledWith(1);
    expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
  });

  it('publishes order.cancelled with metadata', async () => {
    const order = makeOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    await useCase.execute({ orderId: 1, reason: 'Customer requested', cancelledBy: 'manager-1' });

    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.cancelled',
        orderId: 1,
        orderNumber: 'ORD-001',
        customerId: 123,
        reason: 'Customer requested',
        cancelledBy: 'manager-1',
      })
    );
  });

  it('throws OrderNotFoundError when order is missing', async () => {
    mockOrderRepository.getById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 999, reason: 'x', cancelledBy: 'u' })
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('continues cancellation when stock release fails', async () => {
    const order = makeOrder();
    mockOrderRepository.getById.mockResolvedValue(order);
    mockStockService.releaseReservation.mockRejectedValue(new Error('stock unavailable'));

    await useCase.execute({ orderId: 1, reason: 'x', cancelledBy: 'u' });

    expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
    expect(mockEventPublisher.publish).toHaveBeenCalled();
  });

  it('wraps domain cancellation failure', async () => {
    const order = makeOrder(OrderStatus.PAID);
    mockOrderRepository.getById.mockResolvedValue(order);

    await expect(
      useCase.execute({ orderId: 1, reason: 'not allowed', cancelledBy: 'u' })
    ).rejects.toThrow(OrderCancellationError);
  });
});
