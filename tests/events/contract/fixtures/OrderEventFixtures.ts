/**
 * @file Order Event Fixtures
 * @module tests/events/contract/fixtures/OrderEventFixtures
 * @description Pre-built event fixtures for order-related contract tests.
 * These fixtures provide valid event samples for testing.
 */

import { EventEnvelope, EventPriority } from '../../../../../events/types/EventEnvelope';

/**
 * Valid order.created event fixture
 */
export const validOrderCreatedEvent: EventEnvelope = {
  event_id: '550e8400-e29b-41d4-a716-446655440000',
  event_type: 'order.created',
  event_version: 'v1',
  occurred_at: '2026-02-13T10:00:00.000Z',
  producer: 'order-service',
  producer_version: '1.0.0',
  correlation_id: '660e8400-e29b-41d4-a716-446655440000',
  trace_id: '660e8400-e29b-41d4-a716-446655440000',
  routing_key: 'order.created.v1',
  priority: EventPriority.NORMAL,
  payload: {
    order_id: '550e8400-e29b-41d4-a716-446655440000',
    order_number: 'ORD-00012345',
    quote_id: '770e8400-e29b-41d4-a716-446655440000',
    quote_number: 'QT-000123',
    cart_id: '880e8400-e29b-41d4-a716-446655440000',
    customer_id: 'CUST-001',
    customer_type: 'b2b',
    customer_name: 'Acme Corporation',
    customer_email: 'contact@acme.com',
    customer_phone: '+40700123456',
    created_by: 'user-456',
    created_at: '2026-02-13T10:00:00.000Z',
    status: 'pending',
    payment_status: 'pending',
    fulfillment_status: 'unfulfilled',
    items: [
      {
        item_id: '990e8400-e29b-41d4-a716-446655440000',
        product_id: 'PRD-001',
        variant_id: 'VAR-001-A',
        sku: 'PRD-001-A',
        product_name: 'LED Panel 60x60',
        quantity: 10,
        unit_price: 150,
        unit_cost: 100,
        tax_rate: 19,
        tax_amount: 285,
        discount_amount: 0,
        line_total: 1785,
        reserved_stock: true,
      },
    ],
    totals: {
      subtotal: 1500,
      discount_amount: 150,
      tax_amount: 256.5,
      shipping_amount: 25,
      shipping_discount: 0,
      total: 1631.5,
      currency: 'EUR',
    },
    shipping_address: {
      name: 'John Doe',
      company: 'Acme Corporation',
      address_line1: '123 Business Street',
      address_line2: 'Suite 100',
      city: 'Bucharest',
      state_province: 'Bucharest',
      postal_code: '010123',
      country: 'Romania',
      phone: '+40700123456',
    },
    billing_address: {
      name: 'John Doe',
      company: 'Acme Corporation',
      address_line1: '123 Business Street',
      city: 'Bucharest',
      state_province: 'Bucharest',
      postal_code: '010123',
      country: 'Romania',
    },
    shipping_method: {
      method_code: 'standard',
      method_name: 'Standard Delivery',
      cost: 25,
      estimated_days: 3,
      carrier: 'Courier',
    },
    payment_method: {
      method_code: 'bank_transfer',
      method_name: 'Bank Transfer',
      installments: 1,
      payment_term: 'net_30',
    },
    channel: 'admin',
    notes: 'Please include product documentation',
    internal_notes: 'VIP customer - expedite processing',
    promo_code: 'B2B10',
    tax_exempt: false,
    metadata: {
      source: 'manual_entry',
      sales_representative: 'REP-001',
    },
  },
  metadata: {
    user_id: 'user-456',
    session_id: 'sess-789',
    ip_address: '192.168.1.1',
  },
};

/**
 * Minimal order.created event fixture
 */
export const minimalOrderCreatedEvent: EventEnvelope = {
  event_id: 'aabbccdd-1234-5678-abcd-ef1234567890',
  event_type: 'order.created',
  event_version: 'v1',
  occurred_at: '2026-02-13T10:00:00.000Z',
  producer: 'order-service',
  correlation_id: '11223344-5566-7788-99aa-bbccddeeff00',
  trace_id: '11223344-5566-7788-99aa-bbccddeeff00',
  routing_key: 'order.created.v1',
  priority: EventPriority.NORMAL,
  payload: {
    order_id: '550e8400-e29b-41d4-a716-446655440000',
    order_number: 'ORD-00012345',
    customer_id: 'CUST-001',
    customer_type: 'b2c',
    created_at: '2026-02-13T10:00:00.000Z',
    status: 'pending',
    items: [],
    totals: {
      subtotal: 0,
      tax_amount: 0,
      total: 0,
      currency: 'EUR',
    },
    shipping_address: {
      city: 'Bucharest',
      country: 'Romania',
    },
  },
};

/**
 * B2B order.created event fixture
 */
export const b2bOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'b2b-order-id-123456789',
  correlation_id: 'b2b-corr-id-123456789',
  payload: {
    ...validOrderCreatedEvent.payload,
    customer_type: 'b2b',
    customer_name: 'B2B Corporation',
    payment_method: {
      method_code: 'bank_transfer',
      method_name: 'Bank Transfer',
      payment_term: 'net_30',
    },
    items: [
      {
        item_id: 'item-1',
        product_id: 'PRD-001',
        quantity: 100,
        unit_price: 100,
        line_total: 10000,
      },
    ],
    totals: {
      subtotal: 10000,
      discount_amount: 1000,
      tax_amount: 1710,
      total: 10710,
      currency: 'EUR',
    },
  },
};

/**
 * B2C order.created event fixture
 */
export const b2cOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'b2c-order-id-123456789',
  correlation_id: 'b2c-corr-id-123456789',
  payload: {
    ...validOrderCreatedEvent.payload,
    customer_type: 'b2c',
    customer_name: 'John Doe',
    customer_email: 'john.doe@example.com',
    payment_method: {
      method_code: 'card',
      method_name: 'Credit Card',
    },
    items: [
      {
        item_id: 'item-1',
        product_id: 'PRD-001',
        quantity: 2,
        unit_price: 50,
        line_total: 100,
      },
    ],
    totals: {
      subtotal: 100,
      discount_amount: 0,
      tax_amount: 19,
      shipping_amount: 10,
      total: 129,
      currency: 'EUR',
    },
  },
};

/**
 * Guest order.created event fixture
 */
export const guestOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'guest-order-id-123456789',
  correlation_id: 'guest-corr-id-123456789',
  payload: {
    ...validOrderCreatedEvent.payload,
    customer_type: 'guest',
    customer_email: 'guest@example.com',
    items: [
      {
        item_id: 'item-1',
        product_id: 'PRD-001',
        quantity: 1,
        unit_price: 25,
        line_total: 25,
      },
    ],
    totals: {
      subtotal: 25,
      discount_amount: 0,
      tax_amount: 4.75,
      shipping_amount: 5,
      total: 34.75,
      currency: 'EUR',
    },
  },
};

/**
 * High priority order.created event fixture
 */
export const highPriorityOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'high-priority-order-id',
  priority: EventPriority.HIGH,
  payload: {
    ...validOrderCreatedEvent.payload,
    order_number: 'ORD-PRIORITY-001',
  },
};

/**
 * Critical priority order.created event fixture
 */
export const criticalPriorityOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'critical-priority-order-id',
  priority: EventPriority.CRITICAL,
  payload: {
    ...validOrderCreatedEvent.payload,
    order_number: 'ORD-CRITICAL-001',
  },
};

/**
 * Multi-item order.created event fixture
 */
export const multiItemOrderCreatedEvent: EventEnvelope = {
  ...validOrderCreatedEvent,
  event_id: 'multi-item-order-id',
  payload: {
    ...validOrderCreatedEvent.payload,
    items: [
      {
        item_id: 'item-1',
        product_id: 'PRD-001',
        sku: 'PRD-001-A',
        product_name: 'LED Panel 60x60',
        quantity: 10,
        unit_price: 150,
        line_total: 1500,
      },
      {
        item_id: 'item-2',
        product_id: 'PRD-002',
        sku: 'PRD-002-B',
        product_name: 'LED Tube T8',
        quantity: 20,
        unit_price: 25,
        line_total: 500,
      },
      {
        item_id: 'item-3',
        product_id: 'PRD-003',
        sku: 'PRD-003-C',
        product_name: 'LED Bulb E27',
        quantity: 50,
        unit_price: 5,
        line_total: 250,
      },
      {
        item_id: 'item-4',
        product_id: 'PRD-004',
        sku: 'PRD-004-D',
        product_name: 'LED Strip 5m',
        quantity: 15,
        unit_price: 30,
        line_total: 450,
      },
      {
        item_id: 'item-5',
        product_id: 'PRD-005',
        sku: 'PRD-005-E',
        product_name: 'LED Driver',
        quantity: 5,
        unit_price: 75,
        line_total: 375,
      },
    ],
    totals: {
      subtotal: 3075,
      discount_amount: 307.5,
      tax_amount: 525.68,
      shipping_amount: 50,
      total: 3343.18,
      currency: 'EUR',
    },
  },
};

/**
 * Order with all payment statuses
 */
export const orderCreatedPaymentStatuses: Record<string, EventEnvelope> = {
  pending: {
    ...validOrderCreatedEvent,
    event_id: 'order-pending',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'pending' as const },
  },
  authorized: {
    ...validOrderCreatedEvent,
    event_id: 'order-authorized',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'authorized' as const },
  },
  paid: {
    ...validOrderCreatedEvent,
    event_id: 'order-paid',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'paid' as const },
  },
  partial: {
    ...validOrderCreatedEvent,
    event_id: 'order-partial',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'partial' as const },
  },
  refunded: {
    ...validOrderCreatedEvent,
    event_id: 'order-refunded',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'refunded' as const },
  },
  failed: {
    ...validOrderCreatedEvent,
    event_id: 'order-failed',
    payload: { ...validOrderCreatedEvent.payload, payment_status: 'failed' as const },
  },
};

/**
 * Order with all statuses
 */
export const orderCreatedStatuses: Record<string, EventEnvelope> = {
  pending: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-pending',
    payload: { ...validOrderCreatedEvent.payload, status: 'pending' as const },
  },
  confirmed: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-confirmed',
    payload: { ...validOrderCreatedEvent.payload, status: 'confirmed' as const },
  },
  processing: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-processing',
    payload: { ...validOrderCreatedEvent.payload, status: 'processing' as const },
  },
  ready_to_ship: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-ready-to-ship',
    payload: { ...validOrderCreatedEvent.payload, status: 'ready_to_ship' as const },
  },
  shipped: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-shipped',
    payload: { ...validOrderCreatedEvent.payload, status: 'shipped' as const },
  },
  delivered: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-delivered',
    payload: { ...validOrderCreatedEvent.payload, status: 'delivered' as const },
  },
  cancelled: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-cancelled',
    payload: { ...validOrderCreatedEvent.payload, status: 'cancelled' as const },
  },
  refunded: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-refunded',
    payload: { ...validOrderCreatedEvent.payload, status: 'refunded' as const },
  },
  failed: {
    ...validOrderCreatedEvent,
    event_id: 'order-status-failed',
    payload: { ...validOrderCreatedEvent.payload, status: 'failed' as const },
  },
};

/**
 * Invalid order.created event fixtures for testing validation
 */
export const invalidOrderCreatedEvents = {
  missingOrderId: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-missing-order-id',
    payload: {
      ...validOrderCreatedEvent.payload,
      order_id: undefined as any,
    },
  },
  invalidOrderId: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-bad-order-id',
    payload: {
      ...validOrderCreatedEvent.payload,
      order_id: 'not-a-uuid',
    },
  },
  invalidOrderNumber: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-bad-order-number',
    payload: {
      ...validOrderCreatedEvent.payload,
      order_number: 'INVALID',
    },
  },
  invalidCustomerType: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-bad-customer-type',
    payload: {
      ...validOrderCreatedEvent.payload,
      customer_type: 'invalid' as any,
    },
  },
  invalidEmail: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-bad-email',
    payload: {
      ...validOrderCreatedEvent.payload,
      customer_email: 'not-an-email',
    },
  },
  invalidCurrency: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-bad-currency',
    payload: {
      ...validOrderCreatedEvent.payload,
      totals: {
        ...validOrderCreatedEvent.payload.totals,
        currency: 'eur',
      },
    },
  },
  negativeTotal: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-negative-total',
    payload: {
      ...validOrderCreatedEvent.payload,
      totals: {
        ...validOrderCreatedEvent.payload.totals,
        total: -100,
      },
    },
  },
  negativeQuantity: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-negative-quantity',
    payload: {
      ...validOrderCreatedEvent.payload,
      items: [
        {
          ...validOrderCreatedEvent.payload.items[0],
          quantity: -5,
        },
      ],
    },
  },
  missingRequiredItems: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-missing-items',
    payload: {
      ...validOrderCreatedEvent.payload,
      items: undefined as any,
    },
  },
  invalidPaymentMethod: {
    ...validOrderCreatedEvent,
    event_id: 'invalid-payment-method',
    payload: {
      ...validOrderCreatedEvent.payload,
      payment_method: {
        method_code: 'invalid' as any,
        method_name: 'Invalid Payment',
      },
    },
  },
};

/**
 * Get all valid order event fixtures
 */
export function getAllValidOrderEvents(): EventEnvelope[] {
  return [
    validOrderCreatedEvent,
    minimalOrderCreatedEvent,
    b2bOrderCreatedEvent,
    b2cOrderCreatedEvent,
    guestOrderCreatedEvent,
    highPriorityOrderCreatedEvent,
    criticalPriorityOrderCreatedEvent,
    multiItemOrderCreatedEvent,
    ...Object.values(orderCreatedPaymentStatuses),
    ...Object.values(orderCreatedStatuses),
  ];
}

/**
 * Get all invalid order event fixtures
 */
export function getAllInvalidOrderEvents(): EventEnvelope[] {
  return Object.values(invalidOrderCreatedEvents);
}
