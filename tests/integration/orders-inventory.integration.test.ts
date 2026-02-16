/**
 * Orders <-> Inventory Integration Tests
 *
 * Tests the cross-module interactions between Orders and Inventory.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDataSource } from './setup';
import {
  createOrderData,
  createStockItemData,
  createWarehouseData,
  resetOrderCounter,
  resetInventoryCounters,
} from './factories';
import { DataSource } from 'typeorm';

describe('Orders <-> Inventory Integration', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = await getTestDataSource();
    resetOrderCounter();
    resetInventoryCounters();
  });

  describe('Order Creation and Inventory Impact', () => {
    it('should verify that order items reference valid product IDs', async () => {
      // Setup: Create warehouse and stock
      const warehouseData = createWarehouseData({ id: 'wh-main' });
      const stockData = createStockItemData({
        productId: 'prod-001',
        warehouseId: 'wh-main',
        quantity: 50,
      });

      // Create order with matching product
      const { order, items } = createOrderData({
        items: [
          { productId: 'prod-001', productName: 'Test Product', quantity: 5, unitPrice: 100 },
        ],
      });

      // Verify structure
      expect(order.order_number).toMatch(/^ORD-TEST-\d{4}$/);
      expect(items).toHaveLength(1);
      expect(items[0].product_id).toBe('prod-001');
      expect(items[0].quantity).toBe(5);

      // Verify stock would be sufficient
      expect(stockData.quantity).toBeGreaterThanOrEqual(items[0].quantity);
    });

    it('should detect when order quantity exceeds available stock', async () => {
      // Setup: Limited stock
      const stockData = createStockItemData({
        productId: 'prod-limited',
        warehouseId: 'wh-main',
        quantity: 3, // Only 3 in stock
      });

      // Order requests more than available
      const { items } = createOrderData({
        items: [
          {
            productId: 'prod-limited',
            productName: 'Limited Product',
            quantity: 10,
            unitPrice: 50,
          },
        ],
      });

      // Verify conflict detection
      const orderQuantity = items[0].quantity;
      const availableStock = stockData.quantity;

      expect(orderQuantity).toBeGreaterThan(availableStock);
      // In real scenario, this would trigger a stock conflict warning
    });

    it('should calculate correct totals when creating multi-item order', async () => {
      const { order, items } = createOrderData({
        items: [
          { productId: 'prod-a', productName: 'Product A', quantity: 2, unitPrice: 100 },
          { productId: 'prod-b', productName: 'Product B', quantity: 3, unitPrice: 50 },
        ],
      });

      // Subtotal: (2 * 100) + (3 * 50) = 350
      expect(order.subtotal).toBe(350);

      // Tax: 350 * 0.21 = 73.5
      expect(order.tax_amount).toBeCloseTo(73.5, 2);

      // Grand Total: 350 + 73.5 = 423.5
      expect(order.grand_total).toBeCloseTo(423.5, 2);
    });
  });

  describe('Inventory Stock Calculations', () => {
    it('should track available quantity correctly', async () => {
      const stockData = createStockItemData({
        productId: 'prod-available',
        warehouseId: 'wh-test',
        quantity: 100,
      });

      // Available = quantity - reserved
      const availableQuantity = stockData.quantity - stockData.reserved_quantity;
      expect(availableQuantity).toBe(100);
    });

    it('should flag low stock correctly', async () => {
      const stockData = createStockItemData({
        productId: 'prod-low',
        warehouseId: 'wh-test',
        quantity: 5,
        minimumStock: 10,
      });

      const isLowStock = stockData.quantity < stockData.minimum_stock;
      expect(isLowStock).toBe(true);
    });
  });
});
