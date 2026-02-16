# Inventory Management Module - CYPHER ERP

Complete Inventory Management system for CYPHER ERP following hexagonal architecture pattern.

## Architecture Overview

The module is structured in three layers:

### 1. Domain Layer (Pure Business Logic)
- **Entities**: `StockItem`, domain models
- **Services**: `StockFulfillmentService` for order fulfillment logic
- **Ports**: `IInventoryRepository` - outbound port for persistence

### 2. Application Layer (Use Cases)
- `CheckStock` - Get stock levels for products
- `ReserveStock` - Reserve stock for orders
- `ReleaseReservation` - Release stock reservations
- `AdjustStock` - Manual stock adjustments
- `GetLowStockAlerts` - Retrieve low stock alerts
- `GetMovementHistory` - Get stock movement audit trail
- `GetWarehouses` - List all warehouses

### 3. Infrastructure Layer (Adapters)
- **TypeORM Entities**: Database models
- **TypeOrmInventoryRepository**: Repository implementation
- **Redis Cache**: Stock level caching (5 min TTL)
- **Jobs**: BullMQ background jobs
  - SmartBillSyncJob (every 15 minutes)
  - SupplierSyncJob (every 4 hours, 06:00-22:00)
  - AlertCheckJob (every hour)

### 4. API Layer (HTTP Interface)
- **Routes**: Express router with endpoints
- **Controllers**: Request handlers
- **Validators**: Joi schema validation

## File Structure

```
inventory/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── StockItem.ts
│   │   ├── services/
│   │   │   └── StockFulfillmentService.ts
│   │   └── ports/
│   │       └── IInventoryRepository.ts
│   ├── application/
│   │   └── usecases/
│   │       ├── CheckStock.ts
│   │       ├── ReserveStock.ts
│   │       ├── ReleaseReservation.ts
│   │       ├── AdjustStock.ts
│   │       ├── GetLowStockAlerts.ts
│   │       ├── GetMovementHistory.ts
│   │       └── GetWarehouses.ts
│   ├── infrastructure/
│   │   ├── entities/
│   │   │   ├── StockItemEntity.ts
│   │   │   ├── WarehouseEntity.ts
│   │   │   ├── StockMovementEntity.ts
│   │   │   ├── LowStockAlertEntity.ts
│   │   │   └── StockReservationEntity.ts
│   │   ├── repositories/
│   │   │   └── TypeOrmInventoryRepository.ts
│   │   ├── cache/
│   │   │   └── StockCache.ts
│   │   └── jobs/
│   │       ├── SmartBillSyncJob.ts
│   │       ├── SupplierSyncJob.ts
│   │       └── AlertCheckJob.ts
│   └── api/
│       ├── routes/
│       │   └── inventory.routes.ts
│       ├── controllers/
│       │   └── InventoryController.ts
│       └── validators/
│           └── inventory.validators.ts
└── tests/
    ├── domain/
    │   ├── StockFulfillmentService.test.ts
    │   └── StockItem.test.ts
    └── application/
        └── CheckStock.test.ts
```

## API Endpoints

### Stock Information
- `GET /api/v1/inventory/:productId` - Get stock levels
- `POST /api/v1/inventory/check` - Batch check stock
- `GET /api/v1/inventory/:productId/movements` - Movement history

### Stock Operations
- `POST /api/v1/inventory/reserve` - Reserve stock
- `DELETE /api/v1/inventory/reservations/:id` - Release reservation
- `POST /api/v1/inventory/adjust` - Adjust stock (admin only)

### Alerts
- `GET /api/v1/inventory/alerts` - Get low stock alerts
- `POST /api/v1/inventory/alerts/:id/acknowledge` - Acknowledge alert

### Sync Operations (Admin Only)
- `POST /api/v1/inventory/sync/smartbill` - Trigger SmartBill sync
- `POST /api/v1/inventory/sync/suppliers` - Trigger supplier sync

### Configuration
- `GET /api/v1/inventory/warehouses` - List warehouses

## Key Features

### Stock Management
- Real-time stock level tracking across warehouses
- Reserved quantity tracking
- Low stock alert system
- Warehouse priority-based fulfillment

### Stock Movements
- Complete audit trail of all stock movements
- Movement types: IN, OUT, ADJUSTMENT, RESERVATION, RELEASE, LOSS
- Reference tracking (PO, SO, transfers, etc.)

### Caching
- 5-minute TTL cache for stock levels
- Automatic invalidation on stock changes
- Redis-backed for scalability

### Background Jobs
- **SmartBill Sync**: Integrate with external accounting system
- **Supplier Sync**: Update supplier stock levels (off-hours only)
- **Alert Check**: Scan for low stock and create alerts

## Database Entities

### stock_items
- `id` (UUID, PK)
- `product_id` (UUID, FK)
- `warehouse_id` (UUID, FK)
- `quantity` (INTEGER)
- `reserved_quantity` (INTEGER)
- `minimum_threshold` (INTEGER)
- `last_updated` (TIMESTAMP)

### warehouses
- `id` (UUID, PK)
- `name` (VARCHAR)
- `code` (VARCHAR, UNIQUE)
- `priority` (INTEGER)
- `is_active` (BOOLEAN)
- `smartbill_id` (VARCHAR, nullable)
- `created_at` (TIMESTAMP)

### stock_movements
- `id` (UUID, PK)
- `product_id` (UUID, FK)
- `warehouse_id` (UUID, FK)
- `movement_type` (ENUM)
- `quantity` (INTEGER)
- `previous_quantity` (INTEGER)
- `new_quantity` (INTEGER)
- `reason` (VARCHAR, nullable)
- `reference_type` (ENUM, nullable)
- `reference_id` (VARCHAR, nullable)
- `created_by` (UUID)
- `created_at` (TIMESTAMP)

### low_stock_alerts
- `id` (UUID, PK)
- `product_id` (UUID)
- `product_sku` (VARCHAR)
- `product_name` (VARCHAR)
- `warehouse_id` (UUID)
- `current_quantity` (INTEGER)
- `minimum_threshold` (INTEGER)
- `severity` (ENUM: LOW, CRITICAL)
- `acknowledged` (BOOLEAN)
- `acknowledged_by` (UUID, nullable)
- `acknowledged_at` (TIMESTAMP, nullable)
- `created_at` (TIMESTAMP)

### stock_reservations
- `id` (UUID, PK)
- `order_id` (UUID)
- `items` (JSONB)
- `status` (ENUM: ACTIVE, FULFILLED, CANCELLED, EXPIRED)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

## Testing

### Domain Tests
- `StockItem.test.ts` - Stock item business logic (5 tests)
- `StockFulfillmentService.test.ts` - Warehouse fulfillment logic (6 tests)

### Application Tests
- `CheckStock.test.ts` - Stock checking use case (5 tests)

Run tests:
```bash
npm run test
npm run test:watch
npm run test:coverage
```

## Integration Notes

### SmartBill Module
When available, update `SmartBillSyncJob` to call SmartBill service for invoice/payment sync:
```typescript
const smartbillService = container.resolve('SmartBillService');
await smartbillService.syncInventory();
```

### Supplier Module
When available, update `SupplierSyncJob` to sync supplier stock levels:
```typescript
const supplierService = container.resolve('SupplierService');
await supplierService.syncStockLevels();
```

### Events
The module publishes:
- `inventory.low_stock` - When low stock alerts are created

## Configuration

### Environment Variables
- `REDIS_HOST` - Redis connection host
- `REDIS_PORT` - Redis connection port
- `REDIS_DB` - Redis database number

### Caching
- Cache TTL: 300 seconds (5 minutes)
- Keys: `stock:product:{productId}`

### Jobs
- SmartBill: `*/15 * * * *` (every 15 minutes)
- Supplier: `0 6-22/4 * * *` (4-hourly, 06:00-22:00)
- Alerts: `0 * * * *` (every hour)

## Error Handling

All operations include:
- Transaction management for data consistency
- Proper HTTP status codes
- Detailed error messages
- Logging of all errors

## Performance Considerations

- Batch operations supported for stock checks
- Database indexes on frequently queried columns
- Redis caching to reduce database hits
- Efficient warehouse priority sorting
