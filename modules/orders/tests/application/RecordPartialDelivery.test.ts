import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  IEventPublisher,
  RecordPartialDelivery,
} from '../../src/application/use-cases/RecordPartialDelivery';
import { IOrderRepository, Order, OrderItem, OrderStatus, Address } from '../../src/domain';
import { InvalidDeliveryQuantityError, InvalidOrderInputError, OrderNotFoundError } from '../../src/application/errors';

const makeShippedOrder = (): Order => {
  const order = Order.create({
    id: 1,
    orderNumber: 'ORD-001',
    customerId: 123,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    status: OrderStatus.READY_TO_SHIP,
    items: [
      OrderItem.create({
        id: 'item-1',
        productId: 1,
        sku: 'SKU-1',
        productName: 'Product 1',
        quantity: 5,
        unitPrice: 100,
      }),
      OrderItem.create({
        id: 'item-2',
        productId: 2,
        sku: 'SKU-2',
        productName: 'Product 2',
        quantity: 3,
        unitPrice: 50,
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
      city: 'Cluj',
      county: 'Cluj',
      postalCode: '400000',
    }),
    subtotal: 650,
    taxAmount: 123.5,
    shippingCost: 20,
    grandTotal: 793.5,
    paymentTerms: 'net_30',
    createdBy: 'seed',
    updatedBy: 'seed',
  });

  order.updateStatus(OrderStatus.SHIPPED, 'seed');
  return order;
};

describe('RecordPartialDelivery Use Case', () => {
  let useCase: RecordPartialDelivery;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockOrderRepository = {
      getById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    mockEventPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    useCase = new RecordPartialDelivery(mockOrderRepository, mockEventPublisher);
  });

  it('records partial delivery and publishes partial event', async () => {
    const order = makeShippedOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    const result = await useCase.execute({
      orderId: 1,
      items: [{ itemId: 'item-1', quantityDelivered: 2 }],
      userId: 'user-1',
    });

    expect(order.items[0].quantityDelivered).toBe(2);
    expect(order.items[0].quantityRemaining).toBe(3);
    expect(result.isFullyDelivered).toBe(false);
    expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.partially_delivered', orderId: 1 })
    );
  });

  it('auto-transitions to delivered when all items are delivered', async () => {
    const order = makeShippedOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    const result = await useCase.execute({
      orderId: 1,
      items: [
        { itemId: 'item-1', quantityDelivered: 5 },
        { itemId: 'item-2', quantityDelivered: 3 },
      ],
      userId: 'user-1',
    });

    expect(order.status).toBe(OrderStatus.DELIVERED);
    expect(result.isFullyDelivered).toBe(true);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.fully_delivered', orderId: 1 })
    );
  });

  it('throws OrderNotFoundError when order is missing', async () => {
    mockOrderRepository.getById.mockResolvedValue(null);

    await expect(
      useCase.execute({ orderId: 99, items: [{ itemId: 'x', quantityDelivered: 1 }], userId: 'u' })
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('throws InvalidOrderInputError for empty delivery list', async () => {
    mockOrderRepository.getById.mockResolvedValue(makeShippedOrder());

    await expect(useCase.execute({ orderId: 1, items: [], userId: 'u' })).rejects.toThrow(InvalidOrderInputError);
  });

  it('throws InvalidOrderInputError for unknown item id', async () => {
    mockOrderRepository.getById.mockResolvedValue(makeShippedOrder());

    await expect(
      useCase.execute({ orderId: 1, items: [{ itemId: 'missing', quantityDelivered: 1 }], userId: 'u' })
    ).rejects.toThrow(InvalidOrderInputError);
  });

  it('throws InvalidDeliveryQuantityError when quantity exceeds remaining', async () => {
    mockOrderRepository.getById.mockResolvedValue(makeShippedOrder());

    await expect(
      useCase.execute({ orderId: 1, items: [{ itemId: 'item-1', quantityDelivered: 10 }], userId: 'u' })
    ).rejects.toThrow(InvalidDeliveryQuantityError);
  });
});
