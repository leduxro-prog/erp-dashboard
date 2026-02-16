import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  GenerateProforma,
  IEventPublisher,
  IProformaService,
} from '../../src/application/use-cases/GenerateProforma';
import { IOrderRepository, Order, OrderStatus, OrderItem, Address } from '../../src/domain';
import { InvalidOrderInputError, OrderNotFoundError, ProformaGenerationError } from '../../src/application/errors';

const makeOrder = (status: OrderStatus): Order =>
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
        sku: 'SKU-001',
        productName: 'Product 1',
        quantity: 2,
        unitPrice: 100,
      }),
    ],
    billingAddress: Address.create({
      name: 'John Doe',
      street: 'Main 1',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010101',
    }),
    shippingAddress: Address.create({
      name: 'John Doe',
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

describe('GenerateProforma Use Case', () => {
  let useCase: GenerateProforma;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;
  let mockProformaService: jest.Mocked<IProformaService>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockOrderRepository = {
      getById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<IOrderRepository>;

    mockProformaService = {
      generateProforma: jest.fn(),
    } as jest.Mocked<IProformaService>;

    mockEventPublisher = {
      publish: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    useCase = new GenerateProforma(mockOrderRepository, mockProformaService, mockEventPublisher);
  });

  it('generates proforma, updates order, and publishes event', async () => {
    const order = makeOrder(OrderStatus.ORDER_CONFIRMED);
    mockOrderRepository.getById.mockResolvedValue(order);
    mockProformaService.generateProforma.mockResolvedValue('PRO-001-2026');

    const result = await useCase.execute({ orderId: 1, generatedBy: 'user-1' });

    expect(result.proformaNumber).toBe('PRO-001-2026');
    expect(order.proformaNumber).toBe('PRO-001-2026');
    expect(order.updatedBy).toBe('user-1');
    expect(mockOrderRepository.update).toHaveBeenCalledWith(order);
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.proforma_generated',
        orderId: 1,
        orderNumber: 'ORD-001',
      })
    );
  });

  it('allows quote statuses accepted by current contract', async () => {
    const order = makeOrder(OrderStatus.QUOTE_SENT);
    mockOrderRepository.getById.mockResolvedValue(order);
    mockProformaService.generateProforma.mockResolvedValue('PRO-002-2026');

    await expect(useCase.execute({ orderId: 1, generatedBy: 'user-1' })).resolves.toBeDefined();
  });

  it('throws OrderNotFoundError when order does not exist', async () => {
    mockOrderRepository.getById.mockResolvedValue(null);

    await expect(useCase.execute({ orderId: 999, generatedBy: 'user-1' })).rejects.toThrow(OrderNotFoundError);
  });

  it('rejects unsupported statuses', async () => {
    const order = makeOrder(OrderStatus.CANCELLED);
    mockOrderRepository.getById.mockResolvedValue(order);

    await expect(useCase.execute({ orderId: 1, generatedBy: 'user-1' })).rejects.toThrow(InvalidOrderInputError);
  });

  it('wraps external service failure', async () => {
    const order = makeOrder(OrderStatus.ORDER_CONFIRMED);
    mockOrderRepository.getById.mockResolvedValue(order);
    mockProformaService.generateProforma.mockRejectedValue(new Error('SmartBill timeout'));

    await expect(useCase.execute({ orderId: 1, generatedBy: 'user-1' })).rejects.toThrow(ProformaGenerationError);
  });
});
