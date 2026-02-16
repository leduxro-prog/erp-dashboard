/**
 * @file Stock Event Fixtures
 * @module tests/events/contract/fixtures/StockEventFixtures
 * @description Pre-built event fixtures for stock-related contract tests.
 */

import { EventEnvelope, EventPriority } from '../../../../../events/types/EventEnvelope';

/**
 * Valid stock.changed event fixture
 */
export const validStockChangedEvent: EventEnvelope = {
  event_id: 'cc33dd44-ee55-ff66-aa77-bb88cc99dd00',
  event_type: 'stock.changed',
  event_version: 'v1',
  occurred_at: '2026-02-13T12:00:00.000Z',
  producer: 'inventory-service',
  producer_version: '1.0.0',
  correlation_id: 'dd44ee55-ff66-aa77-bb88-cc99dd00ee11',
  trace_id: 'dd44ee55-ff66-aa77-bb88-cc99dd00ee11',
  routing_key: 'stock.changed.v1',
  priority: EventPriority.NORMAL,
  payload: {
    product_id: 'PRD-001',
    sku: 'PRD-001-A',
    location_id: 'LOC-MAIN',
    change_type: 'addition',
    quantity_change: 100,
    quantity_before: 500,
    quantity_after: 600,
    reason: 'Incoming shipment PO-12345',
    reference_id: 'PO-12345',
    reference_type: 'purchase_order',
    performed_by: 'user-123',
    notes: 'Regular stock replenishment',
    metadata: {
      shipment_id: 'SHP-001',
      supplier_id: 'SUP-001',
    },
  },
};

/**
 * Stock addition event fixtures
 */
export const stockAdditionEvents: {
  small: EventEnvelope;
  medium: EventEnvelope;
  large: EventEnvelope;
} = {
  small: {
    ...validStockChangedEvent,
    event_id: 'stock-add-small',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'addition' as const,
      quantity_change: 10,
      quantity_before: 90,
      quantity_after: 100,
      reason: 'Small stock addition',
    },
  },
  medium: {
    ...validStockChangedEvent,
    event_id: 'stock-add-medium',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'addition' as const,
      quantity_change: 100,
      quantity_before: 500,
      quantity_after: 600,
      reason: 'Medium stock addition',
    },
  },
  large: {
    ...validStockChangedEvent,
    event_id: 'stock-add-large',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'addition' as const,
      quantity_change: 1000,
      quantity_before: 5000,
      quantity_after: 6000,
      reason: 'Large bulk shipment',
    },
  },
};

/**
 * Stock removal event fixtures
 */
export const stockRemovalEvents: {
  sale: EventEnvelope;
  return: EventEnvelope;
  damage: EventEnvelope;
  expiry: EventEnvelope;
} = {
  sale: {
    ...validStockChangedEvent,
    event_id: 'stock-rem-sale',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'removal' as const,
      quantity_change: -10,
      quantity_before: 100,
      quantity_after: 90,
      reason: 'Sold to customer CUST-001',
      reference_id: 'ORD-12345',
      reference_type: 'order',
    },
  },
  return: {
    ...validStockChangedEvent,
    event_id: 'stock-rem-return',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'removal' as const,
      quantity_change: -5,
      quantity_before: 50,
      quantity_after: 45,
      reason: 'Customer return',
      reference_id: 'RET-001',
      reference_type: 'return',
    },
  },
  damage: {
    ...validStockChangedEvent,
    event_id: 'stock-rem-damage',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'removal' as const,
      quantity_change: -3,
      quantity_before: 25,
      quantity_after: 22,
      reason: 'Damaged in storage',
      reference_id: 'DAM-001',
      reference_type: 'damage_report',
    },
  },
  expiry: {
    ...validStockChangedEvent,
    event_id: 'stock-rem-expiry',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'removal' as const,
      quantity_change: -20,
      quantity_before: 100,
      quantity_after: 80,
      reason: 'Expired stock',
      reference_id: 'EXP-001',
      reference_type: 'expiry_report',
    },
  },
};

/**
 * Stock adjustment event fixtures
 */
export const stockAdjustmentEvents: {
  correction: EventEnvelope;
  recount: EventEnvelope;
  manual: EventEnvelope;
} = {
  correction: {
    ...validStockChangedEvent,
    event_id: 'stock-adj-corr',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'adjustment' as const,
      quantity_change: 5,
      quantity_before: 95,
      quantity_after: 100,
      reason: 'System correction - found discrepancy',
      reference_id: 'ADJ-001',
      reference_type: 'inventory_adjustment',
      performed_by: 'admin-456',
    },
  },
  recount: {
    ...validStockChangedEvent,
    event_id: 'stock-adj-recount',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'adjustment' as const,
      quantity_change: -10,
      quantity_before: 110,
      quantity_after: 100,
      reason: 'Physical count discrepancy',
      reference_id: 'COUNT-001',
      reference_type: 'physical_count',
    },
  },
  manual: {
    ...validStockChangedEvent,
    event_id: 'stock-adj-manual',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'adjustment' as const,
      quantity_change: 50,
      quantity_before: 100,
      quantity_after: 150,
      reason: 'Manual adjustment by supervisor',
      reference_id: 'MAN-001',
      reference_type: 'manual_adjustment',
    },
  },
};

/**
 * Stock transfer event fixtures
 */
export const stockTransferEvents: {
  warehouseToStore: EventEnvelope;
  storeToStore: EventEnvelope;
} = {
  warehouseToStore: {
    ...validStockChangedEvent,
    event_id: 'stock-trans-wh-store',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'transfer' as const,
      location_id: 'LOC-STORE-001',
      quantity_change: 0,
      quantity_before: 1000,
      quantity_after: 1000,
      reason: 'Transfer from warehouse to store',
      reference_id: 'TRANS-001',
      reference_type: 'stock_transfer',
      metadata: {
        from_location_id: 'LOC-MAIN',
        to_location_id: 'LOC-STORE-001',
      },
    },
  },
  storeToStore: {
    ...validStockChangedEvent,
    event_id: 'stock-trans-store-store',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'transfer' as const,
      location_id: 'LOC-STORE-002',
      quantity_change: 0,
      quantity_before: 50,
      quantity_after: 50,
      reason: 'Transfer between stores',
      reference_id: 'TRANS-002',
      reference_type: 'stock_transfer',
      metadata: {
        from_location_id: 'LOC-STORE-001',
        to_location_id: 'LOC-STORE-002',
      },
    },
  },
};

/**
 * Stock reservation event fixtures
 */
export const stockReservedEvent: EventEnvelope = {
  ...validStockChangedEvent,
  event_id: 'stock-reserved',
  payload: {
    ...validStockChangedEvent.payload,
    change_type: 'reserved' as const,
    quantity_change: 0,
    quantity_before: 100,
    quantity_after: 100,
    reason: 'Stock reserved for order',
    reference_id: 'ORD-12345',
    reference_type: 'order',
    metadata: {
      reserved_quantity: 10,
      reservation_expires: '2026-02-20T12:00:00.000Z',
    },
  },
};

/**
 * Stock release event fixtures
 */
export const stockReleasedEvent: EventEnvelope = {
  ...validStockChangedEvent,
  event_id: 'stock-released',
  payload: {
    ...validStockChangedEvent.payload,
    change_type: 'released' as const,
    quantity_change: 0,
    quantity_before: 100,
    quantity_after: 100,
    reason: 'Stock reservation released - order cancelled',
    reference_id: 'ORD-12345',
    reference_type: 'order',
    metadata: {
      released_quantity: 10,
      original_reservation_id: 'RES-001',
    },
  },
};

/**
 * High priority stock event
 */
export const highPriorityStockEvent: EventEnvelope = {
  ...validStockChangedEvent,
  event_id: 'stock-high-priority',
  priority: EventPriority.HIGH,
  payload: {
    ...validStockChangedEvent.payload,
    quantity_change: -1,
    quantity_before: 1,
    quantity_after: 0,
    reason: 'Last item sold - reorder needed',
    metadata: {
      reorder_needed: true,
      reorder_quantity: 100,
    },
  },
};

/**
 * Critical stock event
 */
export const criticalStockEvent: EventEnvelope = {
  ...validStockChangedEvent,
  event_id: 'stock-critical',
  priority: EventPriority.CRITICAL,
  payload: {
    ...validStockChangedEvent.payload,
    change_type: 'adjustment' as const,
    quantity_change: 0,
    quantity_before: 0,
    quantity_after: 0,
    reason: 'Stock-out event - critical inventory',
    metadata: {
      stockout: true,
      backorders_pending: 5,
      urgent_reorder: true,
    },
  },
};

/**
 * Invalid stock event fixtures
 */
export const invalidStockEvents = {
  missingProductId: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-no-product-id',
    payload: {
      ...validStockChangedEvent.payload,
      product_id: undefined as any,
    },
  },
  missingSku: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-no-sku',
    payload: {
      ...validStockChangedEvent.payload,
      sku: undefined as any,
    },
  },
  missingLocationId: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-no-loc',
    payload: {
      ...validStockChangedEvent.payload,
      location_id: undefined as any,
    },
  },
  invalidChangeType: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-change-type',
    payload: {
      ...validStockChangedEvent.payload,
      change_type: 'invalid' as any,
    },
  },
  negativeAfter: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-negative',
    payload: {
      ...validStockChangedEvent.payload,
      quantity_before: 50,
      quantity_after: -10,
      quantity_change: -60,
      reason: 'Invalid negative quantity',
    },
  },
  zeroQuantity: {
    ...validStockChangedEvent,
    event_id: 'invalid-stock-zero',
    payload: {
      ...validStockChangedEvent.payload,
      quantity_before: 0,
      quantity_after: 0,
      quantity_change: 0,
      reason: 'Zero quantity event',
    },
  },
};

/**
 * Get all valid stock event fixtures
 */
export function getAllValidStockEvents(): EventEnvelope[] {
  return [
    validStockChangedEvent,
    ...Object.values(stockAdditionEvents),
    ...Object.values(stockRemovalEvents),
    ...Object.values(stockAdjustmentEvents),
    ...Object.values(stockTransferEvents),
    stockReservedEvent,
    stockReleasedEvent,
    highPriorityStockEvent,
    criticalStockEvent,
  ];
}

/**
 * Get all invalid stock event fixtures
 */
export function getAllInvalidStockEvents(): EventEnvelope[] {
  return Object.values(invalidStockEvents);
}
