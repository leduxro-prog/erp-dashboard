import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ListOrders } from '../../src/application/use-cases/ListOrders';
import { IOrderRepository, Order, OrderStatus, OrderItem, Address } from '../../src/domain';
import { InvalidOrderInputError } from '../../src/application/errors';

const makeOrder = (id: number, status: OrderStatus = OrderStatus.ORDER_CONFIRMED): Order =>
  Order.create({
    id,
    orderNumber: `ORD-${String(id).padStart(3, '0')}`,
    customerId: 123,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    status,
    items: [
      OrderItem.create({
        id: `item-${id}`,
        productId: 1,
        sku: 'SKU-001',
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

describe('ListOrders Use Case', () => {
  let useCase: ListOrders;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockOrderRepository = {
      list: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    useCase = new ListOrders(mockOrderRepository);
  });

  it('lists orders with pagination and summary mapping', async () => {
    mockOrderRepository.list.mockResolvedValue({
      orders: [makeOrder(1)],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 1,
        orderNumber: 'ORD-001',
        status: OrderStatus.ORDER_CONFIRMED,
      })
    );
    expect(result.pagination.total).toBe(1);
  });

  it('validates page and limit constraints', async () => {
    await expect(useCase.execute({ page: 0, limit: 10 })).rejects.toThrow(InvalidOrderInputError);
    await expect(useCase.execute({ page: 1, limit: 101 })).rejects.toThrow(InvalidOrderInputError);
  });

  it('validates date range', async () => {
    await expect(
      useCase.execute({
        page: 1,
        limit: 10,
        dateFrom: new Date('2026-02-10'),
        dateTo: new Date('2026-02-01'),
      })
    ).rejects.toThrow(InvalidOrderInputError);
  });

  it('passes filters and default sorting to repository', async () => {
    mockOrderRepository.list.mockResolvedValue({
      orders: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });

    await useCase.execute({
      page: 1,
      limit: 10,
      customerId: 123,
      status: OrderStatus.QUOTE_PENDING,
      statuses: [OrderStatus.QUOTE_PENDING, OrderStatus.QUOTE_SENT],
      search: 'john',
    });

    expect(mockOrderRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 123,
        status: OrderStatus.QUOTE_PENDING,
        statuses: [OrderStatus.QUOTE_PENDING, OrderStatus.QUOTE_SENT],
        search: 'john',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    );
  });

  it('supports explicit sorting fields from current contract', async () => {
    mockOrderRepository.list.mockResolvedValue({
      orders: [makeOrder(2, OrderStatus.QUOTE_SENT)],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    await useCase.execute({ page: 1, limit: 10, sortBy: 'orderNumber', sortOrder: 'asc' });

    expect(mockOrderRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'orderNumber', sortOrder: 'asc' })
    );
  });
});
