import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CreateOrder,
  IEventPublisher,
  IProductService,
  IStockService,
} from '../../src/application/use-cases/CreateOrder';
import { CreateOrderInput } from '../../src/application/dtos';
import {
  InvalidOrderInputError,
  InsufficientStockError,
  StockReservationError,
} from '../../src/application/errors';
import {
  IOrderRepository,
  Order,
  OrderStatus,
} from '../../src/domain';
import { Address, OrderItem } from '../../src/domain/entities';

const buildInput = (): CreateOrderInput => ({
  customerId: 123,
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  items: [
    { productId: 1, quantity: 2 },
    { productId: 2, quantity: 1 },
  ],
  billingAddress: {
    name: 'John Doe',
    street: 'Main 1',
    city: 'Bucharest',
    county: 'Bucuresti',
    postalCode: '010101',
    country: 'Romania',
  },
  shippingAddress: {
    name: 'John Doe',
    street: 'Ship 2',
    city: 'Bucharest',
    county: 'Bucuresti',
    postalCode: '010102',
    country: 'Romania',
  },
  paymentTerms: 'net_30',
  shippingCost: 10,
  discountAmount: 5,
  createdBy: 'user-1',
});

const buildSavedOrder = (): Order => {
  const items = [
    OrderItem.create({
      id: 'i1',
      productId: 1,
      sku: 'SKU-1',
      productName: 'Product 1',
      quantity: 2,
      unitPrice: 100,
    }),
    OrderItem.create({
      id: 'i2',
      productId: 2,
      sku: 'SKU-2',
      productName: 'Product 2',
      quantity: 1,
      unitPrice: 50,
    }),
  ];

  return Order.create({
    id: 77,
    orderNumber: 'ORD-20260213-0001',
    customerId: 123,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    status: OrderStatus.QUOTE_PENDING,
    items,
    billingAddress: Address.create({
      name: 'John Doe',
      street: 'Main 1',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010101',
    }),
    shippingAddress: Address.create({
      name: 'John Doe',
      street: 'Ship 2',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010102',
    }),
    subtotal: 250,
    discountAmount: 5,
    taxAmount: 46.55,
    shippingCost: 10,
    grandTotal: 301.55,
    paymentTerms: 'net_30',
    paymentStatus: 'pending',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  });
};

describe('CreateOrder Use Case', () => {
  let useCase: CreateOrder;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockStockService: jest.Mocked<IStockService>;
  let mockProductService: jest.Mocked<IProductService>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockOrderRepository = {
      create: jest.fn(),
      getNextOrderNumber: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    mockStockService = {
      checkAvailability: jest.fn(),
      reserveStock: jest.fn(),
    } as jest.Mocked<IStockService>;

    mockProductService = {
      getProduct: jest.fn(),
      getProducts: jest.fn(),
    } as jest.Mocked<IProductService>;

    mockEventPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    useCase = new CreateOrder(
      mockOrderRepository,
      mockStockService,
      mockProductService,
      mockEventPublisher
    );
  });

  it('creates an order and maps the result payload', async () => {
    const savedOrder = buildSavedOrder();
    mockOrderRepository.getNextOrderNumber.mockResolvedValue('ORD-20260213-0001');
    mockProductService.getProducts.mockResolvedValue([
      { id: 1, sku: 'SKU-1', name: 'Product 1', price: 100 },
      { id: 2, sku: 'SKU-2', name: 'Product 2', price: 50 },
    ]);
    mockStockService.checkAvailability.mockResolvedValue({ available: true, quantity: 20 });
    mockOrderRepository.create.mockResolvedValue(savedOrder);

    const result = await useCase.execute(buildInput());

    expect(result.id).toBe(77);
    expect(result.orderNumber).toBe('ORD-20260213-0001');
    expect(result.status).toBe(OrderStatus.QUOTE_PENDING);
    expect(result.items).toHaveLength(2);
    expect(mockStockService.reserveStock).toHaveBeenCalledWith(77, [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
  });

  it('rejects invalid input before external calls', async () => {
    const input = { ...buildInput(), customerId: 0 };

    await expect(useCase.execute(input)).rejects.toThrow(InvalidOrderInputError);
    expect(mockProductService.getProducts).not.toHaveBeenCalled();
  });

  it('fails when stock is insufficient', async () => {
    mockOrderRepository.getNextOrderNumber.mockResolvedValue('ORD-20260213-0001');
    mockProductService.getProducts.mockResolvedValue([
      { id: 1, sku: 'SKU-1', name: 'Product 1', price: 100 },
      { id: 2, sku: 'SKU-2', name: 'Product 2', price: 50 },
    ]);
    mockStockService.checkAvailability
      .mockResolvedValueOnce({ available: false, quantity: 1 })
      .mockResolvedValueOnce({ available: true, quantity: 100 });

    await expect(useCase.execute(buildInput())).rejects.toThrow(InsufficientStockError);
  });

  it('wraps stock reservation failure as StockReservationError', async () => {
    mockOrderRepository.getNextOrderNumber.mockResolvedValue('ORD-20260213-0001');
    mockProductService.getProducts.mockResolvedValue([
      { id: 1, sku: 'SKU-1', name: 'Product 1', price: 100 },
      { id: 2, sku: 'SKU-2', name: 'Product 2', price: 50 },
    ]);
    mockStockService.checkAvailability.mockResolvedValue({ available: true, quantity: 20 });
    mockOrderRepository.create.mockResolvedValue(buildSavedOrder());
    mockStockService.reserveStock.mockRejectedValue(new Error('reservation unavailable'));

    await expect(useCase.execute(buildInput())).rejects.toThrow(StockReservationError);
  });
});
