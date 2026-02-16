import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GetOrder } from '../../src/application/use-cases/GetOrder';
import { IOrderRepository, Order, OrderStatus, OrderItem, Address } from '../../src/domain';
import { InvalidOrderInputError, OrderNotFoundError } from '../../src/application/errors';

const makeOrder = (): Order => {
  const order = Order.create({
    id: 1,
    orderNumber: 'ORD-001',
    customerId: 123,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    status: OrderStatus.QUOTE_PENDING,
    items: [
      OrderItem.create({
        id: 'item-1',
        productId: 1,
        sku: 'SKU-001',
        productName: 'Product 1',
        quantity: 2,
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
      city: 'Cluj',
      county: 'Cluj',
      postalCode: '400000',
    }),
    subtotal: 200,
    taxAmount: 38,
    shippingCost: 10,
    grandTotal: 248,
    paymentTerms: 'net_30',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  });

  order.updateStatus(OrderStatus.QUOTE_SENT, 'user-1');
  return order;
};

describe('GetOrder Use Case', () => {
  let useCase: GetOrder;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      getById: jest.fn(),
      getByOrderNumber: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    useCase = new GetOrder(mockOrderRepository);
  });

  it('retrieves order by ID and maps details', async () => {
    const order = makeOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    const result = await useCase.execute({ orderId: 1 });

    expect(result.id).toBe(1);
    expect(result.orderNumber).toBe('ORD-001');
    expect(result.items[0].lineTotal).toBe(200);
    expect(result.billingAddress.city).toBe('Bucharest');
    expect(result.createdAt).toMatch(/T/);
  });

  it('retrieves order by order number', async () => {
    const order = makeOrder();
    mockOrderRepository.getByOrderNumber.mockResolvedValue(order);

    const result = await useCase.execute({ orderNumber: 'ORD-001' });

    expect(result.orderNumber).toBe('ORD-001');
    expect(mockOrderRepository.getByOrderNumber).toHaveBeenCalledWith('ORD-001');
  });

  it('throws when no identifier is provided', async () => {
    await expect(useCase.execute({})).rejects.toThrow(InvalidOrderInputError);
  });

  it('throws when order is not found', async () => {
    mockOrderRepository.getById.mockResolvedValue(null);

    await expect(useCase.execute({ orderId: 999 })).rejects.toThrow(OrderNotFoundError);
  });

  it('maps status history entries to ISO strings', async () => {
    const order = makeOrder();
    mockOrderRepository.getById.mockResolvedValue(order);

    const result = await useCase.execute({ orderId: 1 });

    expect(result.statusHistory).toHaveLength(1);
    expect(result.statusHistory[0]).toEqual(
      expect.objectContaining({
        fromStatus: OrderStatus.QUOTE_PENDING,
        toStatus: OrderStatus.QUOTE_SENT,
        changedBy: 'user-1',
      })
    );
    expect(result.statusHistory[0].changedAt).toMatch(/T/);
  });
});
