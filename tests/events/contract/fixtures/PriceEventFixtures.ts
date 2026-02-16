/**
 * @file Price Event Fixtures
 * @module tests/events/contract/fixtures/PriceEventFixtures
 * @description Pre-built event fixtures for price-related contract tests.
 */

import { EventEnvelope, EventPriority } from '../../../../../events/types/EventEnvelope';

/**
 * Valid price.changed event fixture
 */
export const validPriceChangedEvent: EventEnvelope = {
  event_id: 'ee55ff66-aa77-bb88-cc99-dd00ee11ff22',
  event_type: 'price.changed',
  event_version: 'v1',
  occurred_at: '2026-02-13T13:00:00.000Z',
  producer: 'pricing-service',
  producer_version: '1.0.0',
  correlation_id: 'ff66aa77-bb88-cc99-dd00-ee11ff22aa33',
  trace_id: 'ff66aa77-bb88-cc99-dd00-ee11ff22aa33',
  routing_key: 'price.changed.v1',
  priority: EventPriority.NORMAL,
  payload: {
    product_id: 'PRD-001',
    sku: 'PRD-001-A',
    price_type: 'regular',
    currency: 'EUR',
    price_before: 100,
    price_after: 110,
    changed_at: '2026-02-13T13:00:00.000Z',
    change_reason: 'Price increase due to supplier cost',
    effective_from: '2026-02-13T13:00:00.000Z',
    effective_until: undefined,
    tier_id: undefined,
    tier_name: undefined,
    minimum_quantity: undefined,
    customer_group: undefined,
    changed_by: 'manager-123',
    metadata: {
      approval_id: 'APR-001',
      previous_cost: 80,
      new_cost: 90,
    },
  },
};

/**
 * Price type event fixtures
 */
export const priceTypeEvents: {
  regular: EventEnvelope;
  special: EventEnvelope;
  tier: EventEnvelope;
  bulk: EventEnvelope;
  b2b: EventEnvelope;
} = {
  regular: {
    ...validPriceChangedEvent,
    event_id: 'price-regular',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'regular' as const,
      price_before: 100,
      price_after: 110,
    },
  },
  special: {
    ...validPriceChangedEvent,
    event_id: 'price-special',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'special' as const,
      price_before: 100,
      price_after: 85,
      change_reason: 'Promotional discount',
      effective_from: '2026-02-13T00:00:00.000Z',
      effective_until: '2026-03-13T23:59:59.000Z',
    },
  },
  tier: {
    ...validPriceChangedEvent,
    event_id: 'price-tier',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'tier' as const,
      price_after: 90,
      tier_id: 'TIER-GOLD',
      tier_name: 'Gold Customers',
      minimum_quantity: 100,
      customer_group: 'gold',
      change_reason: 'Tier pricing update',
    },
  },
  bulk: {
    ...validPriceChangedEvent,
    event_id: 'price-bulk',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'bulk' as const,
      price_after: 80,
      minimum_quantity: 500,
      change_reason: 'Bulk discount pricing',
    },
  },
  b2b: {
    ...validPriceChangedEvent,
    event_id: 'price-b2b',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'b2b' as const,
      price_before: 120,
      price_after: 100,
      customer_group: 'wholesale',
      change_reason: 'B2B contract pricing',
    },
  },
};

/**
 * Currency event fixtures
 */
export const priceCurrencyEvents: {
  EUR: EventEnvelope;
  USD: EventEnvelope;
  RON: EventEnvelope;
  GBP: EventEnvelope;
} = {
  EUR: {
    ...validPriceChangedEvent,
    event_id: 'price-eur',
    payload: {
      ...validPriceChangedEvent.payload,
      currency: 'EUR',
      price_before: 100,
      price_after: 110,
    },
  },
  USD: {
    ...validPriceChangedEvent,
    event_id: 'price-usd',
    payload: {
      ...validPriceChangedEvent.payload,
      currency: 'USD',
      price_before: 110,
      price_after: 120,
    },
  },
  RON: {
    ...validPriceChangedEvent,
    event_id: 'price-ron',
    payload: {
      ...validPriceChangedEvent.payload,
      currency: 'RON',
      price_before: 500,
      price_after: 550,
    },
  },
  GBP: {
    ...validPriceChangedEvent,
    event_id: 'price-gbp',
    payload: {
      ...validPriceChangedEvent.payload,
      currency: 'GBP',
      price_before: 85,
      price_after: 95,
    },
  },
};

/**
 * Price change direction fixtures
 */
export const priceDirectionEvents: {
  increase: EventEnvelope;
  decrease: EventEnvelope;
  same: EventEnvelope;
} = {
  increase: {
    ...validPriceChangedEvent,
    event_id: 'price-inc',
    payload: {
      ...validPriceChangedEvent.payload,
      price_before: 100,
      price_after: 110,
      change_reason: 'Price increase',
    },
  },
  decrease: {
    ...validPriceChangedEvent,
    event_id: 'price-dec',
    payload: {
      ...validPriceChangedEvent.payload,
      price_before: 110,
      price_after: 100,
      change_reason: 'Price decrease - promotion',
    },
  },
  same: {
    ...validPriceChangedEvent,
    event_id: 'price-same',
    payload: {
      ...validPriceChangedEvent.payload,
      price_before: 100,
      price_after: 100,
      change_reason: 'Price confirmed - no change',
    },
  },
};

/**
 * Tier pricing fixtures
 */
export const tierPricingEvents: {
  bronze: EventEnvelope;
  silver: EventEnvelope;
  gold: EventEnvelope;
  platinum: EventEnvelope;
} = {
  bronze: {
    ...validPriceChangedEvent,
    event_id: 'price-tier-bronze',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'tier' as const,
      price_after: 95,
      tier_id: 'TIER-BRONZE',
      tier_name: 'Bronze Customers',
      minimum_quantity: 10,
      customer_group: 'bronze',
    },
  },
  silver: {
    ...validPriceChangedEvent,
    event_id: 'price-tier-silver',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'tier' as const,
      price_after: 90,
      tier_id: 'TIER-SILVER',
      tier_name: 'Silver Customers',
      minimum_quantity: 50,
      customer_group: 'silver',
    },
  },
  gold: {
    ...validPriceChangedEvent,
    event_id: 'price-tier-gold',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'tier' as const,
      price_after: 85,
      tier_id: 'TIER-GOLD',
      tier_name: 'Gold Customers',
      minimum_quantity: 100,
      customer_group: 'gold',
    },
  },
  platinum: {
    ...validPriceChangedEvent,
    event_id: 'price-tier-platinum',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'tier' as const,
      price_after: 80,
      tier_id: 'TIER-PLATINUM',
      tier_name: 'Platinum Customers',
      minimum_quantity: 500,
      customer_group: 'platinum',
    },
  },
};

/**
 * Bulk pricing fixtures
 */
export const bulkPricingEvents: {
  small: EventEnvelope;
  medium: EventEnvelope;
  large: EventEnvelope;
  extraLarge: EventEnvelope;
} = {
  small: {
    ...validPriceChangedEvent,
    event_id: 'price-bulk-small',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'bulk' as const,
      price_after: 95,
      minimum_quantity: 10,
    },
  },
  medium: {
    ...validPriceChangedEvent,
    event_id: 'price-bulk-medium',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'bulk' as const,
      price_after: 90,
      minimum_quantity: 50,
    },
  },
  large: {
    ...validPriceChangedEvent,
    event_id: 'price-bulk-large',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'bulk' as const,
      price_after: 85,
      minimum_quantity: 100,
    },
  },
  extraLarge: {
    ...validPriceChangedEvent,
    event_id: 'price-bulk-xl',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'bulk' as const,
      price_after: 80,
      minimum_quantity: 500,
    },
  },
};

/**
 * Special pricing fixtures
 */
export const specialPricingEvents: {
  sale: EventEnvelope;
  clearance: EventEnvelope;
  flash: EventEnvelope;
  seasonal: EventEnvelope;
} = {
  sale: {
    ...validPriceChangedEvent,
    event_id: 'price-spec-sale',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'special' as const,
      price_before: 100,
      price_after: 80,
      change_reason: 'Sale promotion',
      effective_from: '2026-02-13T00:00:00.000Z',
      effective_until: '2026-02-28T23:59:59.000Z',
    },
  },
  clearance: {
    ...validPriceChangedEvent,
    event_id: 'price-spec-clearance',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'special' as const,
      price_before: 100,
      price_after: 50,
      change_reason: 'Clearance sale',
      effective_from: '2026-02-13T00:00:00.000Z',
      effective_until: '2026-03-31T23:59:59.000Z',
    },
  },
  flash: {
    ...validPriceChangedEvent,
    event_id: 'price-spec-flash',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'special' as const,
      price_before: 100,
      price_after: 70,
      change_reason: 'Flash sale - 24 hours only',
      effective_from: '2026-02-13T13:00:00.000Z',
      effective_until: '2026-02-14T13:00:00.000Z',
    },
  },
  seasonal: {
    ...validPriceChangedEvent,
    event_id: 'price-spec-seasonal',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'special' as const,
      price_before: 100,
      price_after: 85,
      change_reason: 'Seasonal discount',
      effective_from: '2026-12-01T00:00:00.000Z',
      effective_until: '2026-12-31T23:59:59.000Z',
    },
  },
};

/**
 * High priority price event
 */
export const highPriorityPriceEvent: EventEnvelope = {
  ...validPriceChangedEvent,
  event_id: 'price-high-priority',
  priority: EventPriority.HIGH,
  payload: {
    ...validPriceChangedEvent.payload,
    price_before: 100,
    price_after: 150,
    change_reason: 'Critical price update - supplier cost increase',
    metadata: {
      urgent: true,
      notify_sales_team: true,
    },
  },
};

/**
 * Invalid price event fixtures
 */
export const invalidPriceEvents = {
  missingProductId: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-no-product-id',
    payload: {
      ...validPriceChangedEvent.payload,
      product_id: undefined as any,
    },
  },
  missingSku: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-no-sku',
    payload: {
      ...validPriceChangedEvent.payload,
      sku: undefined as any,
    },
  },
  invalidPriceType: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-type',
    payload: {
      ...validPriceChangedEvent.payload,
      price_type: 'invalid' as any,
    },
  },
  invalidCurrency: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-currency',
    payload: {
      ...validPriceChangedEvent.payload,
      currency: 'eur',
    },
  },
  negativePrice: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-negative',
    payload: {
      ...validPriceChangedEvent.payload,
      price_after: -50,
    },
  },
  missingPriceAfter: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-no-after',
    payload: {
      ...validPriceChangedEvent.payload,
      price_after: undefined as any,
    },
  },
  invalidEffectiveFrom: {
    ...validPriceChangedEvent,
    event_id: 'invalid-price-effect-from',
    payload: {
      ...validPriceChangedEvent.payload,
      effective_from: 'not-a-date' as any,
    },
  },
};

/**
 * Get all valid price event fixtures
 */
export function getAllValidPriceEvents(): EventEnvelope[] {
  return [
    validPriceChangedEvent,
    ...Object.values(priceTypeEvents),
    ...Object.values(priceCurrencyEvents),
    ...Object.values(priceDirectionEvents),
    ...Object.values(tierPricingEvents),
    ...Object.values(bulkPricingEvents),
    ...Object.values(specialPricingEvents),
    highPriorityPriceEvent,
  ];
}

/**
 * Get all invalid price event fixtures
 */
export function getAllInvalidPriceEvents(): EventEnvelope[] {
  return Object.values(invalidPriceEvents);
}
