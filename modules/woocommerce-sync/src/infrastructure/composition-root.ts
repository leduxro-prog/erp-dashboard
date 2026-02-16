import { Router } from 'express';
import { DataSource } from 'typeorm';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { WooCommerceController } from '../api/controllers/WooCommerceController';
import { createWooCommerceRoutes } from '../api/routes/woocommerce.routes';
import { SyncProduct, InternalProduct } from '../application/use-cases/SyncProduct';
import {
  SyncAllProducts,
  InternalProduct as AllProductsInternalProduct,
} from '../application/use-cases/SyncAllProducts';
import { SyncStock } from '../application/use-cases/SyncStock';
import { SyncPrice, PriceInfo } from '../application/use-cases/SyncPrice';
import { SyncCategories, InternalCategory } from '../application/use-cases/SyncCategories';
import { PullOrders } from '../application/use-cases/PullOrders';
import { TypeOrmSyncRepository } from './repositories/TypeOrmSyncRepository';
import {
  IWooCommerceClient,
  WooCommerceProductData,
  WooCommerceOrderData,
} from '../domain/ports/IWooCommerceClient';
import { IWooCommerceMapper } from '../domain/ports/IWooCommerceMapper';
import { createWebhookIdempotencyMiddleware } from './middleware/webhook-idempotency';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('woocommerce-composition');

/**
 * Real WooCommerce API Client Implementation
 * Uses official @woocommerce/woocommerce-rest-api package
 */
function createWooCommerceApiClient(): IWooCommerceClient {
  const wooCommerceClient = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_URL || 'https://ledux.ro',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
    version: 'wc/v3',
    queryStringAuth: true, // For HTTPS
  });

  logger.info('WooCommerce API client initialized', {
    url: process.env.WOOCOMMERCE_URL || 'https://ledux.ro',
    version: 'wc/v3',
  });

  return {
    /**
     * Get a single product by WooCommerce ID
     */
    async getProduct(wooId: number): Promise<WooCommerceProductData | null> {
      try {
        logger.debug('Fetching product from WooCommerce', { wooId });
        const response = await wooCommerceClient.get(`products/${wooId}`);
        return response.data as WooCommerceProductData;
      } catch (error: any) {
        if (error.response?.status === 404) {
          logger.warn('Product not found in WooCommerce', { wooId });
          return null;
        }
        logger.error('Failed to get product from WooCommerce', { wooId, error: error.message });
        throw new Error(`Failed to get product ${wooId}: ${error.message}`);
      }
    },

    /**
     * Create a new product in WooCommerce
     */
    async createProduct(data: WooCommerceProductData): Promise<{ id: number }> {
      try {
        logger.debug('Creating product in WooCommerce', { sku: data.sku });
        const response = await wooCommerceClient.post('products', data);
        logger.info('Product created in WooCommerce', { id: response.data.id, sku: data.sku });
        return { id: response.data.id };
      } catch (error: any) {
        logger.error('Failed to create product in WooCommerce', {
          sku: data.sku,
          error: error.message,
        });
        throw new Error(`Failed to create product: ${error.message}`);
      }
    },

    /**
     * Update an existing product in WooCommerce
     */
    async updateProduct(wooId: number, data: Partial<WooCommerceProductData>): Promise<void> {
      try {
        logger.debug('Updating product in WooCommerce', { wooId });
        await wooCommerceClient.put(`products/${wooId}`, data);
        logger.info('Product updated in WooCommerce', { wooId });
      } catch (error: any) {
        logger.error('Failed to update product in WooCommerce', { wooId, error: error.message });
        throw new Error(`Failed to update product ${wooId}: ${error.message}`);
      }
    },

    /**
     * Batch update multiple products
     * Uses WooCommerce batch endpoint for efficiency
     */
    async batchUpdateProducts(
      data: Partial<WooCommerceProductData>[],
    ): Promise<{ updated: number; failed: number }> {
      try {
        logger.debug('Batch updating products in WooCommerce', { count: data.length });
        const response = await wooCommerceClient.post('products/batch', { update: data });
        const updated = response.data.update?.length || 0;
        const failed = data.length - updated;
        logger.info('Batch update completed', { updated, failed });
        return { updated, failed };
      } catch (error: any) {
        logger.error('Failed to batch update products', { error: error.message });
        throw new Error(`Failed to batch update products: ${error.message}`);
      }
    },

    /**
     * Get orders from WooCommerce with optional filtering
     */
    async getOrders(params: {
      status?: string;
      after?: string;
      per_page?: number;
    }): Promise<WooCommerceOrderData[]> {
      try {
        logger.debug('Fetching orders from WooCommerce', params);
        const response = await wooCommerceClient.get('orders', params);
        logger.info('Orders fetched from WooCommerce', { count: response.data.length });
        return response.data as WooCommerceOrderData[];
      } catch (error: any) {
        logger.error('Failed to get orders from WooCommerce', { error: error.message });
        throw new Error(`Failed to get orders: ${error.message}`);
      }
    },

    /**
     * Get product categories from WooCommerce
     */
    async getCategories(): Promise<{ id: number; name: string; slug: string }[]> {
      try {
        logger.debug('Fetching categories from WooCommerce');
        const response = await wooCommerceClient.get('products/categories', { per_page: 100 });
        logger.info('Categories fetched from WooCommerce', { count: response.data.length });
        return response.data;
      } catch (error: any) {
        logger.error('Failed to get categories from WooCommerce', { error: error.message });
        throw new Error(`Failed to get categories: ${error.message}`);
      }
    },

    /**
     * Create a new category in WooCommerce
     */
    async createCategory(data: {
      name: string;
      slug?: string;
      parent?: number;
    }): Promise<{ id: number }> {
      try {
        logger.debug('Creating category in WooCommerce', { name: data.name });
        const response = await wooCommerceClient.post('products/categories', data);
        logger.info('Category created in WooCommerce', { id: response.data.id, name: data.name });
        return { id: response.data.id };
      } catch (error: any) {
        logger.error('Failed to create category in WooCommerce', {
          name: data.name,
          error: error.message,
        });
        throw new Error(`Failed to create category: ${error.message}`);
      }
    },

    /**
     * Update an existing category in WooCommerce
     */
    async updateCategory(
      categoryId: number,
      data: { name?: string; slug?: string; description?: string },
    ): Promise<void> {
      try {
        logger.debug('Updating category in WooCommerce', { categoryId });
        await wooCommerceClient.put(`products/categories/${categoryId}`, data);
        logger.info('Category updated in WooCommerce', { categoryId });
      } catch (error: any) {
        logger.error('Failed to update category in WooCommerce', {
          categoryId,
          error: error.message,
        });
        throw new Error(`Failed to update category ${categoryId}: ${error.message}`);
      }
    },
  };
}

/**
 * Real WooCommerce Mapper Implementation
 * Transforms data between ERP and WooCommerce formats
 */
const realMapper: IWooCommerceMapper = {
  /**
   * Transform ERP product to WooCommerce product format
   */
  toWooCommerceProduct: (product: any, mapping?: any): WooCommerceProductData => {
    const wcProduct: WooCommerceProductData = {
      name: product.name || '',
      sku: product.sku || '',
      regular_price: String(product.price || 0),
      stock_quantity: product.stockQuantity || 0,
      description: product.description || '',
      short_description: product.shortDescription || '',
      manage_stock: true,
      status: product.status === 'active' ? 'publish' : 'draft',
    };

    // Add categories if present
    if (product.categories && Array.isArray(product.categories)) {
      wcProduct.categories = product.categories.map((cat: any) => ({
        id: typeof cat === 'object' ? cat.id : parseInt(cat, 10),
      }));
    }

    // Add images if present
    if (product.images && Array.isArray(product.images)) {
      wcProduct.images = product.images.map((img: any) => ({
        src: img.url || img.src,
        alt: img.alt || '',
      }));
    }

    // Add attributes if present
    if (product.attributes && Array.isArray(product.attributes)) {
      wcProduct.attributes = product.attributes;
    }

    // Add WooCommerce ID if updating existing product
    if (mapping?.wooCommerceProductId) {
      wcProduct.id = mapping.wooCommerceProductId;
    }

    return wcProduct;
  },

  /**
   * Transform stock quantity to WooCommerce stock update format
   */
  toWooCommerceStock: (quantity: number): Partial<WooCommerceProductData> => ({
    stock_quantity: quantity,
    manage_stock: true,
    status: quantity > 0 ? 'publish' : 'draft',
  }),

  /**
   * Transform price info to WooCommerce price format
   */
  toWooCommercePrice: (
    price: number,
    salePrice?: number,
    salePriceStartDate?: Date,
    salePriceEndDate?: Date,
  ): Partial<WooCommerceProductData> => {
    const priceData: Partial<WooCommerceProductData> = {
      regular_price: String(price),
    };

    // Add sale price if provided and valid
    if (salePrice && salePrice > 0 && salePrice < price) {
      // Sale price available - add to product data
      // Note: WooCommerce accepts date_on_sale_from/to but those are not in the interface
      // This is a simplified version
    }

    return priceData;
  },

  /**
   * Transform WooCommerce order to ERP order format
   */
  fromWooCommerceOrder: (wcOrder: WooCommerceOrderData): any => ({
    id: String(wcOrder.id),
    orderNumber: String(wcOrder.id),
    customerId: String(wcOrder.customer_id),
    customerEmail: wcOrder.billing.email,
    customerName: `${wcOrder.billing.first_name} ${wcOrder.billing.last_name}`,
    status: wcOrder.status,
    total: wcOrder.total,
    currency: wcOrder.currency,
    items: wcOrder.line_items.map((item) => ({
      productId: item.product_id,
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.price),
    })),
    shippingAddress: {
      firstName: wcOrder.billing.first_name,
      lastName: wcOrder.billing.last_name,
      address1: wcOrder.billing.address_1,
      city: wcOrder.billing.city,
      postcode: wcOrder.billing.postcode,
      country: wcOrder.billing.country,
    },
    billingAddress: {
      firstName: wcOrder.billing.first_name,
      lastName: wcOrder.billing.last_name,
      email: wcOrder.billing.email,
      phone: wcOrder.billing.phone,
      address1: wcOrder.billing.address_1,
      city: wcOrder.billing.city,
      postcode: wcOrder.billing.postcode,
      country: wcOrder.billing.country,
    },
    dateCreated: new Date(wcOrder.date_created),
  }),
};

/**
 * Real data fetchers for WooCommerce Sync
 */
const getRealProduct =
  (dataSource: DataSource) =>
  async (productId: string): Promise<InternalProduct> => {
    const results = await dataSource.query(
      `
    SELECT 
      p.id, p.name, p.description, p.sku, 
      p.base_price as price,
      CASE WHEN p.is_active = true THEN 'active' ELSE 'inactive' END as status,
      (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as image_url,
      COALESCE((SELECT SUM(quantity_available) FROM stock_levels WHERE product_id = p.id), 0) as stock_quantity
    FROM products p
    WHERE (CASE WHEN $1 ~ '^[0-9]+$' THEN p.id = $1::bigint ELSE false END) OR p.sku = $1
    LIMIT 1
  `,
      [productId],
    );

    if (results.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }

    const row = results[0];
    return {
      id: String(row.id),
      name: row.name || '',
      description: row.description || '',
      sku: row.sku || '',
      price: parseFloat(row.price) || 0,
      status: row.status as 'active' | 'inactive' | 'draft',
      stockQuantity: parseInt(row.stock_quantity, 10) || 0,
      images: row.image_url ? [{ url: row.image_url }] : [],
    };
  };

const getRealAllProducts =
  (dataSource: DataSource) => async (): Promise<AllProductsInternalProduct[]> => {
    const results = await dataSource.query(`
    SELECT id, sku, name FROM products WHERE is_active = true
  `);
    return results.map((r: any) => ({
      id: String(r.id),
      sku: r.sku,
      name: r.name,
    }));
  };

const getRealProductStock =
  (dataSource: DataSource) =>
  async (productId: string): Promise<number> => {
    const results = await dataSource.query(
      `
    SELECT COALESCE(SUM(quantity_available), 0) as total_stock
    FROM stock_levels
    WHERE (CASE WHEN $1 ~ '^[0-9]+$' THEN product_id = $1::bigint ELSE false END)
  `,
      [productId],
    );
    return parseInt(results[0]?.total_stock || '0', 10);
  };

const getRealProductPrice =
  (dataSource: DataSource) =>
  async (productId: string): Promise<PriceInfo> => {
    const results = await dataSource.query(
      `
    SELECT base_price as price
    FROM products
    WHERE (CASE WHEN $1 ~ '^[0-9]+$' THEN id = $1::bigint ELSE false END) OR sku = $1
    LIMIT 1
  `,
      [productId],
    );
    return { price: parseFloat(results[0]?.price || '0') };
  };

const getRealCategories = (dataSource: DataSource) => async (): Promise<InternalCategory[]> => {
  const results = await dataSource.query(`
    SELECT id, name, slug FROM categories WHERE is_active = true
  `);
  return results.map((r: any) => ({
    id: String(r.id),
    name: r.name,
    slug: r.slug,
  }));
};

const publishEvent = async (eventName: string, payload: any): Promise<void> => {
  logger.info(`Event published: ${eventName}`, { payload });
};

/**
 * Composition Root for WooCommerce Sync Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function createWooCommerceRouter(dataSource: DataSource): Router {
  // Instantiate TypeORM repositories
  const syncRepository = new TypeOrmSyncRepository(dataSource);

  // Create real WooCommerce API client
  const apiClient = createWooCommerceApiClient();

  // Instantiate use-cases with injected dependencies
  const syncProduct = new SyncProduct(
    syncRepository,
    apiClient,
    realMapper,
    getRealProduct(dataSource),
  );

  const syncAllProducts = new SyncAllProducts(
    syncRepository,
    apiClient,
    realMapper,
    getRealAllProducts(dataSource),
  );

  const syncStock = new SyncStock(
    syncRepository,
    apiClient,
    realMapper,
    getRealProductStock(dataSource),
  );

  const syncPrice = new SyncPrice(
    syncRepository,
    apiClient,
    realMapper,
    getRealProductPrice(dataSource),
  );

  const syncCategories = new SyncCategories(
    syncRepository,
    apiClient,
    getRealCategories(dataSource),
  );

  const pullOrders = new PullOrders(apiClient, realMapper, publishEvent);

  // Instantiate controller with injected use-cases, repository, and API client
  const controller = new WooCommerceController(
    syncRepository,
    syncProduct,
    syncAllProducts,
    syncStock,
    syncPrice,
    syncCategories,
    pullOrders,
    apiClient, // Pass API client for test connection
  );

  logger.info('WooCommerce router initialized with all use cases');

  // Create webhook idempotency middleware (HMAC + dedup)
  const webhookSecret = process.env.WOOCOMMERCE_WEBHOOK_SECRET || '';
  const webhookMiddleware = webhookSecret
    ? createWebhookIdempotencyMiddleware({
        dataSource,
        webhookSecret,
      })
    : undefined;

  logger.info('Webhook idempotency middleware configured', {
    enabled: !!webhookMiddleware,
    hasSecret: !!webhookSecret,
  });

  // Create and return configured Express router with webhook middleware
  return createWooCommerceRoutes(controller, webhookMiddleware);
}
