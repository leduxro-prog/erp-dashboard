# Inventory Module - Quick Start Guide

## Installation & Setup

```typescript
import {
  // Domain entities
  StockItem, Warehouse, StockMovement, LowStockAlert, StockReservation,
  // Domain services
  StockFulfillmentService,
  // Repository interface
  IInventoryRepository,
  // Use cases
  CheckStock, ReserveStock, ReleaseStock, AdjustStock,
  GetLowStockAlerts, SyncStock,
  // DTOs
  StockCheckResult, ReservationResultDTO,
  // Errors
  InsufficientStockError, WarehouseNotFoundError
} from '@cypher-erp/inventory';

// Initialize with your repository implementation
const repository = new YourInventoryRepository();
const eventBus = new YourEventBus();

// Create use case instances
const checkStock = new CheckStock(repository);
const reserveStock = new ReserveStock(repository);
const adjustStock = new AdjustStock(repository, eventBus);
```

## Common Operations

### Check Stock Availability

```typescript
const stock = await checkStock.execute(productId);
console.log(`Available: ${stock.totalAvailable}`);
console.log(`Reserved: ${stock.totalReserved}`);
console.log(`Low Stock: ${stock.isLowStock}`);
```

### Reserve Stock for Order

```typescript
const result = await reserveStock.execute(orderId, [
  { productId: 123, quantity: 50 },
  { productId: 456, quantity: 30 }
]);

if (!result.allFulfilled) {
  console.log('Shortfall items:', result.shortfallItems);
  // Create manual supplier order
}
```

### Adjust Stock (Receive Goods)

```typescript
await adjustStock.execute(
  productId,
  warehouseId,
  quantity,           // Positive = add, Negative = remove
  reason,            // e.g., "PO#12345 received"
  userId             // e.g., "user-admin-001"
);
```

### Check Low Stock Alerts

```typescript
const alerts = await getLowStockAlerts.execute(acknowledged: false);

for (const alert of alerts) {
  console.log(`${alert.getProductName()}: ${alert.getCurrentQuantity()} units`);
  
  if (alert.getSeverity() === 'critical') {
    // Order from supplier
  }
}
```

## Error Handling

```typescript
try {
  await reserveStock.execute(orderId, items);
} catch (error) {
  if (error instanceof InsufficientStockError) {
    console.error(`Need ${error.requested}, have ${error.available}`);
  } else if (error instanceof WarehouseNotFoundError) {
    console.error(`Invalid warehouse: ${error.warehouseId}`);
  } else if (error instanceof ProductNotFoundError) {
    console.error(`Product ${error.productId} not in system`);
  }
}
```

## Warehouse Priority

Operations automatically respect:
1. Magazin (Priority 1) - Try first
2. ddepozit (Priority 2) - Try second
3. cantitativ (Priority 3) - Try last

## Key Business Rules

- Low stock threshold: 3 units
- Critical: 0 units
- Max backorder: 10 days
- Manual supplier orders only (no auto-ordering)
- All changes require audit trail
- SmartBill sync: every 15 minutes
- Supplier sync: every 4 hours

## DTOs Overview

```typescript
// Checking stock
interface StockCheckResult {
  productId, totalAvailable, totalReserved,
  warehouses: [{ warehouseId, warehouseName, available, reserved }],
  isLowStock, isCritical
}

// Reserving stock
interface ReservationResultDTO {
  reservationId, orderId,
  items: [{ productId, sources, fulfilled, shortfall }],
  allFulfilled, shortfallItems,
  expiresAt
}

// Syncing
interface SyncResultDTO {
  syncId, status, itemsProcessed, itemsUpdated,
  errors: string[],
  startedAt, completedAt
}
```

## File Structure

```
inventory/src/
├── domain/
│   ├── entities/         (5 entity classes)
│   ├── services/         (fulfillment algorithm)
│   └── repositories/     (IInventoryRepository)
├── application/
│   ├── use-cases/        (6 use case classes)
│   ├── dtos/            (data transfer objects)
│   └── errors/          (7 error types)
└── index.ts             (exports)
```

## Next: Infrastructure

To deploy, you need to:

1. **Implement IInventoryRepository**
   - Extend with database access
   - Map entities to DB records

2. **Create REST API**
   - Endpoint for each use case
   - Validation middleware
   - Error handling

3. **Set up Scheduled Jobs**
   - SmartBill sync (15 min interval)
   - Supplier sync (4 hour interval)

## Quick Test

```typescript
// Check if module loads
import * as inventory from '@cypher-erp/inventory';
console.log('Available classes:', {
  CheckStock: inventory.CheckStock,
  ReserveStock: inventory.ReserveStock,
  AdjustStock: inventory.AdjustStock
});
```

## Support

- **FILE_MANIFEST.md** - File structure & dependencies
- **USAGE_EXAMPLES.md** - Complete code examples
- **README.md** - Architecture & business rules
