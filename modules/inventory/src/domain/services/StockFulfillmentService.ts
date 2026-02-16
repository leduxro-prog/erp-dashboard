export interface FulfillmentWarehouse {
  id: string;
  name: string;
  priority: number;
}

export interface StockItemData {
  warehouse_id: string;
  available_quantity: number;
}

export interface Allocation {
  warehouse_id: string;
  quantity: number;
}

export interface FulfillmentResult {
  fulfilled: boolean;
  allocations: Allocation[];
  shortfall: number;
}

export class StockFulfillmentService {
  fulfillOrder(
    productId: string,
    requestedQuantity: number,
    warehouses: FulfillmentWarehouse[],
    stockItems: StockItemData[],
  ): FulfillmentResult {
    if (requestedQuantity === 0) {
      return {
        fulfilled: true,
        allocations: [],
        shortfall: 0,
      };
    }

    // Sort warehouses by priority
    const sortedWarehouses = [...warehouses].sort((a, b) => a.priority - b.priority);

    const allocations: Allocation[] = [];
    let remaining = requestedQuantity;

    // Try to fulfill from each warehouse in priority order
    for (const warehouse of sortedWarehouses) {
      const stock = stockItems.find((item) => item.warehouse_id === warehouse.id);

      if (!stock || stock.available_quantity === 0) {
        continue;
      }

      const allocate = Math.min(remaining, stock.available_quantity);
      allocations.push({
        warehouse_id: warehouse.id,
        quantity: allocate,
      });

      remaining -= allocate;

      if (remaining === 0) {
        break;
      }
    }

    return {
      fulfilled: remaining === 0,
      allocations,
      shortfall: remaining,
    };
  }
}
