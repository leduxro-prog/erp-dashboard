import { describe, it, expect, beforeEach } from '@jest/globals';
import { StockFulfillmentService } from '../../src/domain/services/StockFulfillmentService';

describe('StockFulfillmentService', () => {
  let service: StockFulfillmentService;

  beforeEach(() => {
    service = new StockFulfillmentService();
  });

  it('should fulfill from Magazin warehouse first (priority 1)', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Magazin', priority: 1 },
      { id: 'wh-2', name: 'Shop', priority: 2 },
    ];

    const stockItems = [
      {
        warehouse_id: 'wh-1',
        available_quantity: 50,
      },
      {
        warehouse_id: 'wh-2',
        available_quantity: 100,
      },
    ];

    const result = service.fulfillOrder(
      'product-1',
      30,
      warehouses as any,
      stockItems as any,
    );

    expect(result.fulfilled).toBe(true);
    expect(result.shortfall).toBe(0);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].warehouse_id).toBe('wh-1');
    expect(result.allocations[0].quantity).toBe(30);
  });

  it('should split across warehouses if single warehouse insufficient', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Magazin', priority: 1 },
      { id: 'wh-2', name: 'Shop', priority: 2 },
    ];

    const stockItems = [
      {
        warehouse_id: 'wh-1',
        available_quantity: 20,
      },
      {
        warehouse_id: 'wh-2',
        available_quantity: 15,
      },
    ];

    const result = service.fulfillOrder(
      'product-1',
      30,
      warehouses as any,
      stockItems as any,
    );

    expect(result.fulfilled).toBe(true);
    expect(result.shortfall).toBe(0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0].quantity).toBe(20);
    expect(result.allocations[1].quantity).toBe(10);
  });

  it('should report shortfall when total insufficient', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Magazin', priority: 1 },
      { id: 'wh-2', name: 'Shop', priority: 2 },
    ];

    const stockItems = [
      {
        warehouse_id: 'wh-1',
        available_quantity: 10,
      },
      {
        warehouse_id: 'wh-2',
        available_quantity: 15,
      },
    ];

    const result = service.fulfillOrder(
      'product-1',
      50,
      warehouses as any,
      stockItems as any,
    );

    expect(result.fulfilled).toBe(false);
    expect(result.shortfall).toBe(25);
    expect(result.allocations).toHaveLength(2);
  });

  it('should handle empty warehouses', () => {
    const warehouses: any[] = [];

    const stockItems: any[] = [];

    const result = service.fulfillOrder(
      'product-1',
      30,
      warehouses,
      stockItems,
    );

    expect(result.fulfilled).toBe(false);
    expect(result.shortfall).toBe(30);
    expect(result.allocations).toHaveLength(0);
  });

  it('should respect warehouse priority order', () => {
    const warehouses = [
      { id: 'wh-3', name: 'Priority 3', priority: 3 },
      { id: 'wh-1', name: 'Magazin', priority: 1 },
      { id: 'wh-2', name: 'Priority 2', priority: 2 },
    ];

    const stockItems = [
      {
        warehouse_id: 'wh-3',
        available_quantity: 100,
      },
      {
        warehouse_id: 'wh-1',
        available_quantity: 50,
      },
      {
        warehouse_id: 'wh-2',
        available_quantity: 50,
      },
    ];

    const result = service.fulfillOrder(
      'product-1',
      30,
      warehouses as any,
      stockItems as any,
    );

    expect(result.fulfilled).toBe(true);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].warehouse_id).toBe('wh-1');
  });

  it('should handle zero quantity requests', () => {
    const warehouses = [
      { id: 'wh-1', name: 'Magazin', priority: 1 },
    ];

    const stockItems = [
      {
        warehouse_id: 'wh-1',
        available_quantity: 50,
      },
    ];

    const result = service.fulfillOrder(
      'product-1',
      0,
      warehouses as any,
      stockItems as any,
    );

    expect(result.fulfilled).toBe(true);
    expect(result.shortfall).toBe(0);
    expect(result.allocations).toHaveLength(0);
  });
});
