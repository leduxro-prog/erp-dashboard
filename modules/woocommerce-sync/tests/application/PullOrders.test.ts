import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PullOrders } from '../../src/application/use-cases/PullOrders';
import {
  IWooCommerceClient,
  WooCommerceOrderData,
} from '../../src/domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../../src/domain/ports/IWooCommerceMapper';
import { PulledOrder } from '../../src/application/dtos/woocommerce.dtos';
import { SyncError } from '../../src/application/errors/woocommerce.errors';

describe('PullOrders', () => {
  let pullOrders: PullOrders;
  let mockApiClient: jest.Mocked<IWooCommerceClient>;
  let mockMapper: jest.Mocked<IWooCommerceMapper>;
  let mockPublishEvent: jest.MockedFunction<
    (eventName: string, payload: any) => Promise<void>
  >;

  beforeEach(() => {
    mockApiClient = {
      getProduct: jest.fn(),
      createProduct: jest.fn(),
      updateProduct: jest.fn(),
      batchUpdateProducts: jest.fn(),
      getOrders: jest.fn(),
      getCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
    } as unknown as jest.Mocked<IWooCommerceClient>;

    mockMapper = {
      toWooCommerceProduct: jest.fn(),
      toWooCommerceStock: jest.fn(),
      toWooCommercePrice: jest.fn(),
      fromWooCommerceOrder: jest.fn(),
    } as unknown as jest.Mocked<IWooCommerceMapper>;

    mockPublishEvent = jest.fn() as jest.MockedFunction<
      (eventName: string, payload: any) => Promise<void>
    >;
    mockPublishEvent.mockResolvedValue();

    pullOrders = new PullOrders(mockApiClient, mockMapper, mockPublishEvent);
  });

  const wcOrder: WooCommerceOrderData = {
    id: 100,
    status: 'processing',
    date_created: '2024-01-01T10:00:00Z',
    customer_id: 1,
    billing: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@test.com',
      phone: '0700000000',
      address_1: 'Street 1',
      city: 'Bucharest',
      postcode: '010101',
      country: 'RO',
    },
    line_items: [],
    total: '99.99',
    currency: 'USD',
  };

  const pulledOrder: PulledOrder = {
    id: 100,
    orderNumber: '100',
    customerId: 1,
    customerEmail: 'test@test.com',
    customerName: 'Test User',
    status: 'processing',
    total: '99.99',
    currency: 'USD',
    paymentMethod: 'cod',
    shippingTotal: '0',
    taxTotal: '0',
    subtotal: '99.99',
    items: [],
    shippingAddress: {
      firstName: 'Test',
      lastName: 'User',
      address1: 'Street 1',
      city: 'Bucharest',
      state: 'B',
      postcode: '010101',
      country: 'RO',
    },
    billingAddress: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
      phone: '0700000000',
      address1: 'Street 1',
      city: 'Bucharest',
      state: 'B',
      postcode: '010101',
      country: 'RO',
    },
    dateCreated: new Date('2024-01-01T10:00:00Z'),
    dateModified: new Date('2024-01-01T10:00:00Z'),
  };

  it('pulls processing orders and publishes mapped payload', async () => {
    mockApiClient.getOrders.mockResolvedValue([wcOrder]);
    mockMapper.fromWooCommerceOrder.mockReturnValue(pulledOrder);

    const result = await pullOrders.execute();

    expect(result).toEqual([pulledOrder]);
    expect(mockApiClient.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        per_page: 100,
        orderby: 'date',
        order: 'asc',
      })
    );
    expect(mockMapper.fromWooCommerceOrder).toHaveBeenCalledWith(wcOrder);
    expect(mockPublishEvent).toHaveBeenCalledWith('woocommerce.order_received', {
      orderId: pulledOrder.id,
      orderNumber: pulledOrder.orderNumber,
      customerId: pulledOrder.customerId,
      customerEmail: pulledOrder.customerEmail,
      total: pulledOrder.total,
      currency: pulledOrder.currency,
      items: pulledOrder.items,
      shippingAddress: pulledOrder.shippingAddress,
      billingAddress: pulledOrder.billingAddress,
      dateCreated: pulledOrder.dateCreated,
    });
  });

  it('adds since filter to WooCommerce query params', async () => {
    const since = new Date('2024-01-01T00:00:00Z');
    mockApiClient.getOrders.mockResolvedValue([]);

    await pullOrders.execute(since);

    expect(mockApiClient.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        after: since.toISOString(),
      })
    );
  });

  it('publishes one event per pulled order', async () => {
    const secondOrder: PulledOrder = {
      ...pulledOrder,
      id: 101,
      orderNumber: '101',
    };

    mockApiClient.getOrders.mockResolvedValue([wcOrder, { ...wcOrder, id: 101 }]);
    mockMapper.fromWooCommerceOrder
      .mockReturnValueOnce(pulledOrder)
      .mockReturnValueOnce(secondOrder);

    await pullOrders.execute();

    expect(mockPublishEvent).toHaveBeenCalledTimes(2);
  });

  it('wraps client errors in SyncError', async () => {
    mockApiClient.getOrders.mockRejectedValue(new Error('API Error'));

    await expect(pullOrders.execute()).rejects.toThrow(SyncError);
    await expect(pullOrders.execute()).rejects.toThrow(
      'Failed to pull orders: API Error'
    );
  });
});
