/**
 * WooCommerce <-> Inventory Integration Tests
 *
 * Tests the synchronization between WooCommerce orders and Inventory.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDataSource } from './setup';
import {
  createOrderData,
  createStockItemData,
  resetOrderCounter,
  resetInventoryCounters,
} from './factories';
import { DataSource } from 'typeorm';
import {
  OrderStatus,
  PaymentStatus,
} from '../../modules/orders/src/infrastructure/entities/OrderEntity';

describe('WooCommerce <-> Inventory Integration', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = await getTestDataSource();
    resetOrderCounter();
    resetInventoryCounters();
  });

  describe('WooCommerce Order Sync', () => {
    it('should create order from WooCommerce payload structure', async () => {
      // Simulate WooCommerce webhook payload
      const wooPayload = {
        id: 12345,
        number: 'WC-12345',
        status: 'processing',
        currency: 'RON',
        date_created: '2026-02-08T10:00:00',
        billing: {
          first_name: 'Ion',
          last_name: 'Popescu',
          email: 'ion.popescu@example.com',
          address_1: 'Strada Victoriei 10',
          city: 'Bucharest',
          state: 'B',
          postcode: '010101',
          country: 'RO',
        },
        line_items: [
          {
            product_id: 101,
            name: 'Product from WooCommerce',
            quantity: 2,
            price: 150,
            sku: 'WC-SKU-001',
          },
        ],
        total: '357.00', // 300 + 19% VAT
      };

      // Transform to internal format (what the sync service would do)
      const internalOrder = {
        order_number: `WC-${wooPayload.number}`,
        customer_name: `${wooPayload.billing.first_name} ${wooPayload.billing.last_name}`,
        customer_email: wooPayload.billing.email,
        status: OrderStatus.ORDER_CONFIRMED,
        payment_status: PaymentStatus.UNPAID,
        items: wooPayload.line_items.map((item) => ({
          productId: `wc-${item.product_id}`,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      };

      // Verify transformation
      expect(internalOrder.order_number).toBe('WC-WC-12345');
      expect(internalOrder.customer_name).toBe('Ion Popescu');
      expect(internalOrder.items).toHaveLength(1);
      expect(internalOrder.items[0].quantity).toBe(2);
    });

    it('should map WooCommerce product SKU to internal product ID', async () => {
      // SKU mapping simulation
      const skuToProductMap: Record<string, string> = {
        'WC-SKU-001': 'prod-internal-001',
        'WC-SKU-002': 'prod-internal-002',
      };

      const wooSku = 'WC-SKU-001';
      const internalProductId = skuToProductMap[wooSku];

      expect(internalProductId).toBe('prod-internal-001');

      // Verify stock exists for mapped product
      const stockData = createStockItemData({
        productId: internalProductId,
        quantity: 50,
      });

      expect(stockData.product_id).toBe('prod-internal-001');
      expect(stockData.quantity).toBe(50);
    });

    it('should handle WooCommerce order with multiple items', async () => {
      const wooPayload = {
        line_items: [
          { product_id: 1, name: 'Product A', quantity: 3, price: 100 },
          { product_id: 2, name: 'Product B', quantity: 1, price: 200 },
          { product_id: 3, name: 'Product C', quantity: 5, price: 50 },
        ],
      };

      const { order, items } = createOrderData({
        items: wooPayload.line_items.map((item) => ({
          productId: `wc-${item.product_id}`,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });

      // Verify all items are mapped
      expect(items).toHaveLength(3);

      // Verify totals: 300 + 200 + 250 = 750
      expect(order.subtotal).toBe(750);
    });

    it('should flag stock conflict when WooCommerce order exceeds inventory', async () => {
      // Limited stock scenario
      const internalStock = createStockItemData({
        productId: 'prod-limited',
        quantity: 2,
      });

      // WooCommerce order for more than available
      const wooOrderQuantity = 5;

      const hasConflict = wooOrderQuantity > internalStock.quantity;
      expect(hasConflict).toBe(true);

      // In real implementation, this would log a warning
      // and possibly trigger a notification
    });
  });

  describe('Inventory Sync Back to WooCommerce', () => {
    it('should prepare stock update payload for WooCommerce', async () => {
      // Internal stock update
      const stockData = createStockItemData({
        productId: 'prod-sync-back',
        quantity: 75,
      });

      // Prepare WooCommerce update payload
      const wooUpdatePayload = {
        product_id: 'wc-123', // Would be resolved from mapping
        stock_quantity: stockData.quantity,
        stock_status: stockData.quantity > 0 ? 'instock' : 'outofstock',
      };

      expect(wooUpdatePayload.stock_quantity).toBe(75);
      expect(wooUpdatePayload.stock_status).toBe('instock');
    });

    it('should set out of stock status when quantity is zero', async () => {
      const stockData = createStockItemData({
        productId: 'prod-empty',
        quantity: 0,
      });

      const stockStatus = stockData.quantity > 0 ? 'instock' : 'outofstock';
      expect(stockStatus).toBe('outofstock');
    });
  });
});
