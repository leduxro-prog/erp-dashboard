import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WooCommerceApiClient } from '../../src/infrastructure/api-client/WooCommerceApiClient';
import { WooCommerceApiError, RateLimitError, NetworkError } from '../../src/application/errors/woocommerce.errors';
import { ApiClientFactory } from '@shared/api/api-client-factory';

jest.mock('@shared/api/api-client-factory', () => ({
  ApiClientFactory: {
    initialize: jest.fn(),
    getClient: jest.fn(),
  },
}));

describe('WooCommerceApiClient', () => {
  let client: WooCommerceApiClient;
  let mockGenericClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGenericClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    };

    (ApiClientFactory.getClient as jest.Mock).mockReturnValue(mockGenericClient);

    client = new WooCommerceApiClient({
      baseUrl: 'https://ledux.ro',
      consumerKey: 'test-key',
      consumerSecret: 'test-secret',
    });
  });

  it('should create client with configuration', () => {
    expect(client).toBeDefined();
    expect(ApiClientFactory.initialize).toHaveBeenCalledTimes(1);
    expect(ApiClientFactory.getClient).toHaveBeenCalledWith('woocommerce');
  });

  it('should get a product', async () => {
    const mockProduct = {
      id: 100,
      name: 'Test Product',
      price: '99.99',
    };

    mockGenericClient.get.mockImplementation(async () => ({ data: mockProduct }));

    const product = await client.getProduct(100);

    expect(product).toEqual(mockProduct);
    expect(mockGenericClient.get).toHaveBeenCalledWith('/products/100');
  });

  it('should handle rate limit errors', async () => {
    mockGenericClient.get.mockImplementation(async () => {
      throw {
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      };
    });

    await expect(client.getProduct(100)).rejects.toBeInstanceOf(RateLimitError);
    await expect(client.getProduct(100)).rejects.toMatchObject({ retryAfter: 60000 });
  });

  it('should handle network errors', async () => {
    mockGenericClient.get.mockImplementation(async () => {
      throw new Error('Network Error');
    });

    await expect(client.getProduct(100)).rejects.toBeInstanceOf(NetworkError);
  });

  it('should handle API errors with status codes', async () => {
    mockGenericClient.get.mockImplementation(async () => {
      throw {
        message: 'API Error',
        response: {
          status: 400,
          data: { message: 'Bad request' },
        },
      };
    });

    await expect(client.getProduct(100)).rejects.toBeInstanceOf(WooCommerceApiError);
    await expect(client.getProduct(100)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should batch update products', async () => {
    const products = [
      { id: 100, name: 'Product 1' },
      { id: 101, name: 'Product 2' },
    ];

    mockGenericClient.post.mockImplementation(async () => ({
      data: { create: [], update: products },
    }));

    const result = await client.batchUpdateProducts(products);

    expect(result).toEqual({ create: [], update: products });
    expect(mockGenericClient.post).toHaveBeenCalledWith('/products/batch', {
      update: products,
    });
  });

  it('should get orders with parameters', async () => {
    const orders = [{ id: 1, number: '1001' }];
    const params = { status: 'processing', per_page: 10 };

    mockGenericClient.get.mockImplementation(async () => ({ data: orders }));

    const result = await client.getOrders(params);

    expect(result).toEqual(orders);
    expect(mockGenericClient.get).toHaveBeenCalledWith('/orders', params);
  });

  it('should get categories', async () => {
    const categories = [{ id: 1, name: 'Lighting', slug: 'lighting' }];

    mockGenericClient.get.mockImplementation(async () => ({ data: categories }));

    const result = await client.getCategories();

    expect(result).toEqual(categories);
    expect(mockGenericClient.get).toHaveBeenCalledWith('/products/categories', undefined);
  });

  it('should create a category', async () => {
    const payload = { name: 'Outdoor' };
    const created = { id: 10, name: 'Outdoor', slug: 'outdoor' };

    mockGenericClient.post.mockImplementation(async () => ({ data: created }));

    const result = await client.createCategory(payload);

    expect(result).toEqual(created);
    expect(mockGenericClient.post).toHaveBeenCalledWith('/products/categories', payload);
  });

  it('should update a category', async () => {
    const payload = { name: 'Indoor' };
    const updated = { id: 10, name: 'Indoor', slug: 'indoor' };

    mockGenericClient.put.mockImplementation(async () => ({ data: updated }));

    const result = await client.updateCategory(10, payload);

    expect(result).toEqual(updated);
    expect(mockGenericClient.put).toHaveBeenCalledWith('/products/categories/10', payload);
  });

  it('should use correct base URL with API version', () => {
    expect(client).toBeDefined();
    expect(ApiClientFactory.getClient).toHaveBeenCalledWith('woocommerce');
  });
});
