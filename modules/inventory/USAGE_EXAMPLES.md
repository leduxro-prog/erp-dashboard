# Inventory Management Module - Usage Examples

Practical examples showing how to use the Inventory Management module in your application.

## Setup and Initialization

```typescript
import {
  CheckStock,
  ReserveStock,
  ReleaseStock,
  AdjustStock,
  GetLowStockAlerts,
  SyncStock,
} from '@cypher-erp/inventory';
import { InventoryRepository } from './infrastructure/repositories';
import { EventBus } from './shared/event-bus';

// Initialize repository
const repository = new InventoryRepository();
const eventBus = new EventBus();

// Create use case instances
const checkStock = new CheckStock(repository);
const reserveStock = new ReserveStock(repository);
const releaseStock = new ReleaseStock(repository);
const adjustStock = new AdjustStock(repository, eventBus);
const getLowStockAlerts = new GetLowStockAlerts(repository);
const syncStock = new SyncStock(smartBillService, supplierService);
```

## Checking Stock Levels

### Check Single Product

```typescript
try {
  const result = await checkStock.execute(productId: 123);
  
  console.log('Stock Check Result:');
  console.log(`Product: ${result.productId}`);
  console.log(`Total Available: ${result.totalAvailable}`);
  console.log(`Total Reserved: ${result.totalReserved}`);
  console.log(`Is Low Stock: ${result.isLowStock}`);
  console.log(`Is Critical: ${result.isCritical}`);
  
  // Per-warehouse breakdown
  for (const warehouse of result.warehouses) {
    console.log(`${warehouse.warehouseName}: ${warehouse.available} available, ${warehouse.reserved} reserved`);
  }
} catch (error) {
  if (error instanceof ProductNotFoundError) {
    console.error(`Product not found: ${error.productId}`);
  }
}
```

### Check Multiple Products

```typescript
const productIds = [123, 456, 789];
const results = await checkStock.executeBatch(productIds);

for (const result of results) {
  console.log(`${result.productId}: ${result.totalAvailable} units available`);
}
```

## Reserving Stock

### Simple Order Reservation

```typescript
try {
  const result = await reserveStock.execute(
    orderId: 'ORD-2025-001',
    items: [
      { productId: 123, quantity: 50 },
      { productId: 456, quantity: 30 },
    ]
  );
  
  console.log('Reservation Result:');
  console.log(`Reservation ID: ${result.reservationId}`);
  console.log(`All Fulfilled: ${result.allFulfilled}`);
  
  for (const item of result.items) {
    console.log(`Product ${item.productId}: ${item.fulfilled ? 'FULFILLED' : 'PARTIAL'}`);
    for (const source of item.sources) {
      console.log(`  - ${source.warehouseName}: ${source.quantity} units (Priority ${source.priority})`);
    }
    if (item.shortfall > 0) {
      console.log(`  - Shortfall: ${item.shortfall} units (requires supplier order)`);
    }
  }
} catch (error) {
  if (error instanceof InsufficientStockError) {
    console.error(`Insufficient stock for product ${error.productId}`);
  }
}
```

### Reservation with Custom Backorder Window

```typescript
// Allow up to 20 days for backorder instead of default 10
const result = await reserveStock.execute(
  orderId: 'ORD-2025-002',
  items: [{ productId: 123, quantity: 100 }],
  backorderDaysMax: 20
);

console.log(`Reservation expires: ${result.expiresAt}`);
```

## Releasing Reservations

### Release Order Reservation

```typescript
try {
  await releaseStock.execute(reservationId: 'RES-123456');
  console.log('Reservation released successfully');
} catch (error) {
  if (error instanceof ReservationNotFoundError) {
    console.error(`Reservation not found: ${error.reservationId}`);
  } else if (error instanceof InvalidStockOperationError) {
    console.error(`Cannot release: ${error.message}`);
  }
}
```

## Manual Stock Adjustments

### Increase Stock (Goods Received)

```typescript
try {
  await adjustStock.execute(
    productId: 123,
    warehouseId: 'wh-magazin-001',
    quantity: 100,  // Positive = add stock
    reason: 'Supplier delivery - PO#SUP-2025-001',
    userId: 'user-admin-001'
  );
  
  console.log('Stock increased successfully');
  // Event 'inventory.stock_changed' published automatically
} catch (error) {
  if (error instanceof WarehouseNotFoundError) {
    console.error(`Warehouse not found: ${error.warehouseId}`);
  }
}
```

### Decrease Stock (Damaged Goods, Correction)

```typescript
try {
  await adjustStock.execute(
    productId: 123,
    warehouseId: 'wh-magazin-001',
    quantity: -5,  // Negative = remove stock
    reason: 'Inventory correction - damaged goods found during stocktake',
    userId: 'user-supervisor-002'
  );
  
  console.log('Stock decreased successfully');
} catch (error) {
  console.error(`Adjustment failed: ${error.message}`);
}
```

### Stock Transfer Between Warehouses

```typescript
// Step 1: Decrease from source warehouse
await adjustStock.execute(
  productId: 123,
  warehouseId: 'wh-magazin-001',
  quantity: -50,
  reason: 'Transfer to ddepozit warehouse',
  userId: 'user-warehouse-001'
);

// Step 2: Increase at destination warehouse
await adjustStock.execute(
  productId: 123,
  warehouseId: 'wh-ddepozit-002',
  quantity: 50,
  reason: 'Received transfer from Magazin warehouse',
  userId: 'user-warehouse-002'
);
```

## Managing Low Stock Alerts

### Get Unacknowledged Alerts

```typescript
try {
  const alerts = await getLowStockAlerts.execute(acknowledged: false);
  
  console.log(`Found ${alerts.length} unacknowledged alerts:`);
  
  for (const alert of alerts) {
    const severityEmoji = alert.getSeverity() === 'critical' ? '🚨' : '⚠️';
    console.log(
      `${severityEmoji} ${alert.getProductName()} (${alert.getProductSku()}) ` +
      `in ${alert.getWarehouseName()}: ` +
      `${alert.getCurrentQuantity()}/${alert.getMinimumThreshold()} units`
    );
  }
} catch (error) {
  console.error('Failed to fetch alerts:', error.message);
}
```

### Acknowledge Alert

```typescript
try {
  await getLowStockAlerts.acknowledgeAlert(
    alertId: 'alert-123',
    userId: 'user-manager-001'
  );
  
  console.log('Alert acknowledged');
} catch (error) {
  console.error('Failed to acknowledge alert:', error.message);
}
```

### Get All Alerts (Including Acknowledged)

```typescript
const allAlerts = await getLowStockAlerts.execute();

const unacknowledged = allAlerts.filter(a => !a.isAcknowledged());
const acknowledged = allAlerts.filter(a => a.isAcknowledged());

console.log(`Unacknowledged: ${unacknowledged.length}`);
console.log(`Acknowledged: ${acknowledged.length}`);
```

## Synchronizing Stock

### Sync from SmartBill

```typescript
try {
  const result = await syncStock.syncSmartBill();
  
  console.log('SmartBill Sync Result:');
  console.log(`Sync ID: ${result.syncId}`);
  console.log(`Status: ${result.status}`);
  console.log(`Items Processed: ${result.itemsProcessed}`);
  console.log(`Items Updated: ${result.itemsUpdated}`);
  
  if (result.errors.length > 0) {
    console.error('Errors during sync:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
  }
  
  console.log(`Duration: ${result.completedAt.getTime() - result.startedAt.getTime()}ms`);
} catch (error) {
  if (error instanceof StockSyncError) {
    console.error(`${error.syncSource} sync failed: ${error.details}`);
  }
}
```

### Sync from Suppliers

```typescript
const result = await syncStock.syncSuppliers();

if (result.status === 'success') {
  console.log('All supplier stocks synced successfully');
} else if (result.status === 'partial') {
  console.warn(`Supplier sync completed with ${result.errors.length} errors`);
} else {
  console.error('Supplier sync failed');
}
```

### Sync All Sources

```typescript
try {
  const both = await syncStock.syncAll();
  
  console.log('All Sync Results:');
  console.log(`SmartBill: ${both.smartBill.status} (${both.smartBill.itemsUpdated} items)`);
  console.log(`Suppliers: ${both.suppliers.status} (${both.suppliers.itemsUpdated} items)`);
} catch (error) {
  console.error('Sync operation failed:', error.message);
}
```

## Event Bus Integration

### Subscribe to Stock Changes

```typescript
// When AdjustStock publishes, other modules can subscribe
eventBus.subscribe('inventory.stock_changed', async (event) => {
  console.log(`Stock changed event received:`);
  console.log(`  Product: ${event.productId}`);
  console.log(`  Warehouse: ${event.warehouseName}`);
  console.log(`  Change: ${event.previousQuantity} → ${event.newQuantity}`);
  console.log(`  Reason: ${event.reason}`);
  
  if (event.isLowStock) {
    console.warn(`WARNING: Product is now low on stock!`);
  }
  
  if (event.isCritical) {
    console.error(`CRITICAL: Product out of stock!`);
    // Trigger critical alert notification
  }
});
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
try {
  const result = await reserveStock.execute(orderId, items);
  
  if (!result.allFulfilled) {
    // Partial fulfillment - some items have shortfall
    console.warn('Partial fulfillment:');
    for (const item of result.shortfallItems) {
      console.log(`Product ${item.productId}: need ${item.shortfall} more units`);
    }
    
    // Trigger manual supplier order workflow
    await createManualSupplierOrder(result.shortfallItems);
  }
} catch (error) {
  if (error instanceof ProductNotFoundError) {
    console.error(`Product ${error.productId} not in system`);
    // Handle missing product
  } else if (error instanceof InsufficientStockError) {
    console.error(`Stock too low for product ${error.productId}`);
    // Suggest waiting for supplier delivery
  } else if (error instanceof WarehouseNotFoundError) {
    console.error(`Invalid warehouse ${error.warehouseId}`);
    // Configuration error
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }
}
```

## Real-World Scenarios

### Complete Order Processing Flow

```typescript
async function processOrder(order: Order): Promise<void> {
  try {
    // 1. Check if stock is available
    const stocks = await checkStock.executeBatch(
      order.items.map(i => i.productId)
    );
    
    for (const stock of stocks) {
      if (stock.isCritical) {
        throw new Error(`Product ${stock.productId} is out of stock`);
      }
    }
    
    // 2. Reserve stock for the order
    const reservation = await reserveStock.execute(
      order.id,
      order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
    );
    
    // 3. Save reservation ID to order
    order.inventoryReservationId = reservation.reservationId;
    await order.save();
    
    // 4. Proceed with order fulfillment
    await fulfillOrder(order, reservation);
    
  } catch (error) {
    console.error(`Order processing failed: ${error.message}`);
    // Release partial reservations if needed
    throw error;
  }
}
```

### Daily Inventory Sync Job

```typescript
async function dailyInventorySyncJob(): Promise<void> {
  console.log('Starting daily inventory sync...');
  
  try {
    // Sync from all sources
    const results = await syncStock.syncAll();
    
    // Check for critical errors
    const hasCriticalErrors = [results.smartBill, results.suppliers].some(
      r => r.status === 'failed'
    );
    
    if (hasCriticalErrors) {
      // Alert admin
      await notificationService.alertAdmin(
        'Inventory sync failed',
        'Manual intervention required'
      );
    }
    
    // Log sync statistics
    const totalProcessed = results.smartBill.itemsProcessed + results.suppliers.itemsProcessed;
    const totalUpdated = results.smartBill.itemsUpdated + results.suppliers.itemsUpdated;
    
    console.log(`Sync complete: ${totalProcessed} items processed, ${totalUpdated} updated`);
  } catch (error) {
    console.error('Daily sync job failed:', error);
    await notificationService.alertAdmin('Daily inventory sync failed', error.message);
  }
}
```

### Automated Low Stock Reorder

```typescript
async function checkAndReorderLowStock(): Promise<void> {
  const alerts = await getLowStockAlerts.execute(acknowledged: false);
  
  for (const alert of alerts) {
    if (alert.getSeverity() === 'critical') {
      // Auto-reorder for critical items
      const order = await createSupplierOrder({
        productId: alert.getProductId(),
        quantity: 100,  // Standard reorder quantity
        reason: 'Auto-reorder due to critical stock level',
        requestedBy: 'system'
      });
      
      // Acknowledge the alert
      await getLowStockAlerts.acknowledgeAlert(
        alert.getId(),
        userId: 'system'
      );
      
      console.log(`Auto-reordered product ${alert.getProductId()}`);
    }
  }
}
```

## Testing Patterns

### Unit Test Example

```typescript
describe('CheckStock', () => {
  let checkStock: CheckStock;
  let mockRepository: IInventoryRepository;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    checkStock = new CheckStock(mockRepository);
  });
  
  it('should return stock check result for valid product', async () => {
    const result = await checkStock.execute(123);
    
    expect(result.productId).toBe(123);
    expect(result.totalAvailable).toBeGreaterThanOrEqual(0);
    expect(result.warehouses).toHaveLength(3);
  });
  
  it('should throw ProductNotFoundError for unknown product', async () => {
    await expect(checkStock.execute(999)).rejects.toThrow(ProductNotFoundError);
  });
});
```

### Integration Test Example

```typescript
describe('ReserveStock Integration', () => {
  let reserveStock: ReserveStock;
  let repository: InventoryRepository;
  
  beforeEach(async () => {
    repository = new InventoryRepository(testDatabase);
    reserveStock = new ReserveStock(repository);
  });
  
  it('should reserve stock and update available quantity', async () => {
    const result = await reserveStock.execute('ORD-001', [
      { productId: 123, quantity: 50 }
    ]);
    
    expect(result.allFulfilled).toBe(true);
    
    const stock = await repository.getStockItem(123, 'wh-magazin-001');
    expect(stock.getReservedQuantity()).toBe(50);
  });
});
```
