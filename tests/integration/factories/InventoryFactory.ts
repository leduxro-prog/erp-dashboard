/**
 * Inventory Factory
 * Generates test inventory data for integration tests.
 */

export interface CreateWarehouseInput {
    id?: string;
    name?: string;
    location?: string;
}

export interface CreateStockItemInput {
    productId?: string;
    warehouseId?: string;
    quantity?: number;
    minimumStock?: number;
    maximumStock?: number;
}

let warehouseCounter = 0;
let productCounter = 0;

export function createWarehouseData(input: CreateWarehouseInput = {}) {
    warehouseCounter++;
    return {
        id: input.id || `wh-test-${String(warehouseCounter).padStart(3, '0')}`,
        name: input.name || `Test Warehouse ${warehouseCounter}`,
        location: input.location || 'Bucharest',
        is_active: true,
    };
}

export function createStockItemData(input: CreateStockItemInput = {}) {
    productCounter++;
    return {
        product_id: input.productId || `prod-test-${String(productCounter).padStart(3, '0')}`,
        warehouse_id: input.warehouseId || 'wh-test-001',
        quantity: input.quantity ?? 100,
        reserved_quantity: 0,
        minimum_stock: input.minimumStock ?? 10,
        maximum_stock: input.maximumStock ?? 1000,
    };
}

export function resetInventoryCounters() {
    warehouseCounter = 0;
    productCounter = 0;
}
