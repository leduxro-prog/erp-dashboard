# Inventory Management Module - File Manifest

Complete listing of all files created for the DOMAIN and APPLICATION layers.

## Directory Structure

```
/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/inventory/src/
├── domain/
│   ├── entities/
│   │   ├── StockItem.ts
│   │   ├── Warehouse.ts
│   │   ├── StockMovement.ts
│   │   ├── LowStockAlert.ts
│   │   ├── StockReservation.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── StockFulfillmentService.ts
│   │   └── index.ts
│   ├── repositories/
│   │   ├── IInventoryRepository.ts
│   │   └── index.ts
│   └── index.ts
├── application/
│   ├── use-cases/
│   │   ├── CheckStock.ts
│   │   ├── ReserveStock.ts
│   │   ├── ReleaseStock.ts
│   │   ├── AdjustStock.ts
│   │   ├── GetLowStockAlerts.ts
│   │   ├── SyncStock.ts
│   │   └── index.ts
│   ├── dtos/
│   │   ├── inventory.dtos.ts
│   │   └── index.ts
│   ├── errors/
│   │   ├── inventory.errors.ts
│   │   └── index.ts
│   └── index.ts
├── index.ts
└── [README.md at module root]
```

## Domain Layer Files

### /domain/entities/StockItem.ts
**Purpose:** Core stock entity representing inventory for a product in a warehouse.

**Exports:**
- `InsufficientStockError` - Exception thrown when stock cannot be reserved
- `StockItemProps` - Interface for constructor properties
- `StockItem` - Main entity class with:
  - `availableQuantity()` - Returns quantity - reserved
  - `isLowStock()` - Checks if available <= threshold
  - `isCritical()` - Checks if available <= 0
  - `reserve(qty)` - Reserves stock for order
  - `release(qty)` - Releases reserved stock
  - `adjust(qty, reason)` - Adjusts quantity with audit

**Lines:** 158
**Key Methods:** reserve, release, adjust, availableQuantity, isLowStock, isCritical

### /domain/entities/Warehouse.ts
**Purpose:** Warehouse location entity with priority rules.

**Exports:**
- `WarehouseCode` - Type: 'magazin' | 'ddepozit' | 'cantitativ'
- `WarehouseProps` - Interface for properties
- `Warehouse` - Entity class with:
  - `isMainWarehouse()` - Returns code === 'magazin'
  - `getDefaultWarehouses()` - Static factory for 3 configured warehouses

**Lines:** 84
**Key Methods:** isMainWarehouse, getDefaultWarehouses

### /domain/entities/StockMovement.ts
**Purpose:** Immutable audit trail for all stock changes.

**Exports:**
- `MovementType` - Type enum for movement classification
- `ReferenceType` - Type enum for reference classification
- `StockMovementProps` - Interface for properties
- `StockMovement` - Immutable entity with:
  - `create(params)` - Static factory method

**Lines:** 145
**Key Methods:** create (static factory)

### /domain/entities/LowStockAlert.ts
**Purpose:** Alert entity for low/critical stock notification.

**Exports:**
- `AlertSeverity` - Type: 'warning' | 'critical'
- `LowStockAlertProps` - Interface for properties
- `LowStockAlert` - Entity class with:
  - `acknowledge(userId)` - Acknowledges alert
  - `determineSeverity(qty)` - Static method for severity
  - `create(params)` - Static factory method

**Lines:** 156
**Key Methods:** acknowledge, determineSeverity (static)

### /domain/entities/StockReservation.ts
**Purpose:** Reservation entity for pending orders with expiration.

**Exports:**
- `ReservationStatus` - Type: 'active' | 'fulfilled' | 'released' | 'expired'
- `ReservationItem` - Interface for items in reservation
- `StockReservationProps` - Interface for properties
- `StockReservation` - Entity class with:
  - `isExpired()` - Checks if reservation expired
  - `isActive()` - Checks if status=active and not expired
  - `fulfill()` - Transitions to fulfilled
  - `release()` - Transitions to released
  - `expire()` - Transitions to expired
  - `create(params)` - Static factory
  - `createWithBackorderWindow(params)` - Factory with 10-day default

**Lines:** 165
**Key Methods:** isExpired, isActive, fulfill, release, expire, create (static), createWithBackorderWindow (static)

### /domain/entities/index.ts
**Purpose:** Re-exports all entity classes.

**Exports:** All from StockItem, Warehouse, StockMovement, LowStockAlert, StockReservation

**Lines:** 5

### /domain/services/StockFulfillmentService.ts
**Purpose:** Service implementing the priority-based fulfillment algorithm.

**Exports:**
- `FulfillmentSource` - Interface for fulfillment source info
- `FulfillmentPlan` - Interface for fulfillment result
- `StockFulfillmentService` - Service class with:
  - `findFulfillmentSources(productId, quantity, stockItems, warehouseNames)` - Main algorithm

**Lines:** 88
**Algorithm:** Tries warehouses in priority order (Magazin → ddepozit → cantitativ)

### /domain/services/index.ts
**Purpose:** Re-exports all services.

**Exports:** StockFulfillmentService

**Lines:** 1

### /domain/repositories/IInventoryRepository.ts
**Purpose:** Port interface defining persistence contract.

**Exports:**
- `IInventoryRepository` - Interface with 16 methods:
  - Stock queries: getStockByProduct, getStockByWarehouse, getStockItem
  - Stock updates: updateStock, bulkUpdateStock
  - Audit: createMovement, getMovements
  - Alerts: getLowStockItems, getAlerts, createAlert, acknowledgeAlert
  - Reservations: createReservation, getReservation, updateReservation
  - Reference: getWarehouses

**Lines:** 43
**Methods:** 16 async methods

### /domain/repositories/index.ts
**Purpose:** Re-exports repository interfaces.

**Exports:** IInventoryRepository

**Lines:** 1

### /domain/index.ts
**Purpose:** Root domain exports.

**Exports:** All entities, services, and repositories

**Lines:** 3

## Application Layer Files

### /application/dtos/inventory.dtos.ts
**Purpose:** Data transfer objects for API responses and operations.

**Exports:**
- `WarehouseStockInfo` - Per-warehouse stock breakdown
- `StockCheckResult` - Result of stock check operation
- `ReservationItemDTO` - Single reservation item request
- `FulfillmentSourceDTO` - Fulfillment source in response
- `ReservationItemResultDTO` - Reservation item with fulfillment details
- `ReservationResultDTO` - Complete reservation result
- `AdjustStockDTO` - Stock adjustment request
- `SyncResultDTO` - Sync operation result

**Lines:** 73
**Key DTOs:** StockCheckResult, ReservationResultDTO, SyncResultDTO

### /application/dtos/index.ts
**Purpose:** Re-exports all DTOs.

**Exports:** All from inventory.dtos

**Lines:** 1

### /application/errors/inventory.errors.ts
**Purpose:** Application-specific error classes.

**Exports:**
- `InsufficientStockError` - Stock reserve failure
- `WarehouseNotFoundError` - Warehouse lookup failure
- `ReservationNotFoundError` - Reservation lookup failure
- `StockSyncError` - Sync operation failure
- `InvalidStockOperationError` - Illegal operation state
- `ProductNotFoundError` - Product not found
- `ReservationExpiredError` - Operation on expired reservation

**Lines:** 62
**Key Errors:** 7 custom error classes

### /application/errors/index.ts
**Purpose:** Re-exports all error classes.

**Exports:** All from inventory.errors

**Lines:** 1

### /application/use-cases/CheckStock.ts
**Purpose:** Use case for checking stock levels.

**Exports:**
- `CheckStock` - Class with:
  - `execute(productId)` - Check single product
  - `executeBatch(productIds)` - Check multiple products

**Lines:** 71
**Returns:** StockCheckResult with per-warehouse breakdown

### /application/use-cases/ReserveStock.ts
**Purpose:** Use case for reserving stock for orders.

**Exports:**
- `ReserveStock` - Class with:
  - `execute(orderId, items, backorderDaysMax?)` - Reserve stock

**Lines:** 115
**Returns:** ReservationResultDTO with sources and shortfalls

### /application/use-cases/ReleaseStock.ts
**Purpose:** Use case for releasing stock reservations.

**Exports:**
- `ReleaseStock` - Class with:
  - `execute(reservationId)` - Release reservation

**Lines:** 41
**Validates:** Reservation exists and is active

### /application/use-cases/AdjustStock.ts
**Purpose:** Use case for manual stock adjustment.

**Exports:**
- `EventBus` - Interface for event publishing
- `AdjustStock` - Class with:
  - `execute(productId, warehouseId, quantity, reason, userId)` - Adjust stock

**Lines:** 105
**Publishes:** inventory.stock_changed event

### /application/use-cases/GetLowStockAlerts.ts
**Purpose:** Use case for managing low stock alerts.

**Exports:**
- `GetLowStockAlerts` - Class with:
  - `execute(acknowledged?)` - Get alerts
  - `acknowledgeAlert(alertId, userId)` - Acknowledge alert

**Lines:** 21
**Returns:** Array of LowStockAlert

### /application/use-cases/SyncStock.ts
**Purpose:** Use case for synchronizing stock from external sources.

**Exports:**
- `SmartBillSyncService` - Interface for SmartBill sync
- `SupplierSyncService` - Interface for Supplier sync
- `SyncStock` - Class with:
  - `syncSmartBill()` - Sync from SmartBill
  - `syncSuppliers()` - Sync from Suppliers
  - `syncAll()` - Sync both sources

**Lines:** 85
**Returns:** SyncResultDTO with items processed, updated, and errors

### /application/use-cases/index.ts
**Purpose:** Re-exports all use cases.

**Exports:** All 6 use cases

**Lines:** 6

### /application/index.ts
**Purpose:** Root application exports.

**Exports:** Use cases, DTOs, Errors

**Lines:** 3

## File Statistics

### Domain Layer
- **Entity Files:** 5 (StockItem, Warehouse, StockMovement, LowStockAlert, StockReservation)
- **Service Files:** 1 (StockFulfillmentService)
- **Repository Files:** 1 (IInventoryRepository)
- **Index Files:** 3
- **Total Lines:** ~800

### Application Layer
- **Use Case Files:** 6 (CheckStock, ReserveStock, ReleaseStock, AdjustStock, GetLowStockAlerts, SyncStock)
- **DTO Files:** 1
- **Error Files:** 1
- **Index Files:** 3
- **Total Lines:** ~400

### Overall
- **Total Implementation Files:** 17 (excluding index files)
- **Total Files:** 20 (including index files)
- **Total Lines:** ~1200
- **Zero External Dependencies:** ✓ (Pure TypeScript)

## File Dependencies

### Domain Layer Dependencies
```
entities/
  ├── StockItem.ts (no deps)
  ├── Warehouse.ts (no deps)
  ├── StockMovement.ts (no deps)
  ├── LowStockAlert.ts (no deps)
  └── StockReservation.ts (no deps)
  
services/
  └── StockFulfillmentService.ts
      └── depends on: StockItem (entity)
      
repositories/
  └── IInventoryRepository.ts
      └── depends on: All entities
```

### Application Layer Dependencies
```
use-cases/
  ├── CheckStock.ts
  │   └── depends on: IInventoryRepository, StockCheckResult DTO
  ├── ReserveStock.ts
  │   └── depends on: IInventoryRepository, StockFulfillmentService, StockReservation, DTOs, ProductNotFoundError
  ├── ReleaseStock.ts
  │   └── depends on: IInventoryRepository, Errors
  ├── AdjustStock.ts
  │   ├── depends on: IInventoryRepository, StockMovement, LowStockAlert, Warehouse, Errors, EventBus
  ├── GetLowStockAlerts.ts
  │   └── depends on: IInventoryRepository, LowStockAlert
  └── SyncStock.ts
      └── depends on: SmartBillSyncService, SupplierSyncService, Errors

dtos/
  └── inventory.dtos.ts (no deps)
  
errors/
  └── inventory.errors.ts (no deps)
```

## Creation Order

For implementation in a fresh project:

1. **Entity files first** (no dependencies)
   - StockItem.ts
   - Warehouse.ts
   - StockMovement.ts
   - LowStockAlert.ts
   - StockReservation.ts

2. **Domain services** (depends on entities)
   - StockFulfillmentService.ts

3. **Repository interface** (depends on entities)
   - IInventoryRepository.ts

4. **Application DTOs and Errors** (no dependencies)
   - inventory.dtos.ts
   - inventory.errors.ts

5. **Use cases** (depends on domain and DTOs)
   - CheckStock.ts
   - ReserveStock.ts
   - ReleaseStock.ts
   - AdjustStock.ts
   - GetLowStockAlerts.ts
   - SyncStock.ts

6. **Index files** (re-exports)
   - All index.ts files at domain and application levels
