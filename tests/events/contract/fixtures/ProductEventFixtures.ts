/**
 * @file Product Event Fixtures
 * @module tests/events/contract/fixtures/ProductEventFixtures
 * @description Pre-built event fixtures for product-related contract tests.
 */

import { EventEnvelope, EventPriority } from '../../../../../events/types/EventEnvelope';

/**
 * Valid product.updated event fixture
 */
export const validProductUpdatedEvent: EventEnvelope = {
  event_id: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
  event_type: 'product.updated',
  event_version: 'v1',
  occurred_at: '2026-02-13T11:00:00.000Z',
  producer: 'product-service',
  producer_version: '1.0.0',
  correlation_id: 'bb22cc33-ee44-ff55-aa66-bb77889900aa',
  trace_id: 'bb22cc33-ee44-ff55-aa66-bb77889900aa',
  routing_key: 'product.updated.v1',
  priority: EventPriority.NORMAL,
  payload: {
    product_id: 'PRD-001',
    sku: 'PRD-001-A',
    updated_at: '2026-02-13T11:00:00.000Z',
    updated_by: 'user-123',
    change_type: 'name_changed',
    previous_values: {
      name: 'LED Panel 60x60',
      description: 'Standard LED panel',
      short_description: 'LED panel',
    },
    new_values: {
      name: 'LED Panel 60x60 Pro',
      description: 'Professional LED panel with improved efficiency',
      short_description: 'Pro LED panel',
    },
    product: {
      name: 'LED Panel 60x60 Pro',
      description: 'Professional LED panel with improved efficiency',
      short_description: 'Pro LED panel',
      category_id: 'CAT-001',
      category_path: 'Lighting > Panels > LED',
      brand_id: 'BRAND-001',
      brand_name: 'Ledux',
      manufacturer: 'Ledux Manufacturing',
      status: 'active',
      visibility: 'visible',
      product_type: 'simple',
      requires_shipping: true,
      is_taxable: true,
      tax_class: 'standard',
      weight: 2.5,
      weight_unit: 'kg',
      dimensions: {
        length: 60,
        width: 60,
        height: 3,
        unit: 'cm',
      },
      attributes: [
        {
          code: 'wattage',
          name: 'Wattage',
          value: 36,
          type: 'number',
          visible: true,
        },
        {
          code: 'color_temperature',
          name: 'Color Temperature',
          value: '4000K',
          type: 'select',
          visible: true,
        },
      ],
      tags: ['led', 'panel', 'lighting', 'commercial'],
      images: [
        {
          image_id: 'IMG-001',
          url: 'https://example.com/images/product-001.jpg',
          alt_text: 'LED Panel 60x60 Pro',
          position: 0,
          is_primary: true,
        },
      ],
      seo: {
        meta_title: 'LED Panel 60x60 Pro | Ledux',
        meta_description: 'Professional LED panel with improved efficiency',
        meta_keywords: ['led', 'panel', 'lighting'],
        slug: 'led-panel-60x60-pro',
      },
      has_variants: false,
      variant_count: 0,
      active_variant_ids: [],
      created_at: '2026-01-01T00:00:00.000Z',
      published_at: '2026-01-01T00:00:00.000Z',
    },
    variants_affected: [],
    notes: 'Product name updated for better SEO',
    metadata: {
      update_reason: 'marketing',
      approved_by: 'manager-456',
    },
  },
  metadata: {
    user_id: 'user-123',
  },
};

/**
 * Product name change fixture
 */
export const productNameChangedEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'product-name-change-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'name_changed' as const,
    previous_values: { name: 'Old Name' },
    new_values: { name: 'New Name' },
  },
};

/**
 * Product description change fixture
 */
export const productDescriptionChangedEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'product-desc-change-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'description_changed' as const,
    previous_values: {
      description: 'Old description',
      short_description: 'Old short',
    },
    new_values: {
      description: 'New description',
      short_description: 'New short',
    },
  },
};

/**
 * Product category change fixture
 */
export const productCategoryChangedEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'product-cat-change-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'category_changed' as const,
    previous_values: {
      category_id: 'CAT-OLD',
      category_path: 'Old > Category',
    },
    new_values: {
      category_id: 'CAT-NEW',
      category_path: 'New > Category',
    },
  },
};

/**
 * Product attributes change fixture
 */
export const productAttributesChangedEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'product-attr-change-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'attributes_changed' as const,
    previous_values: {
      wattage: 36,
    },
    new_values: {
      wattage: 48,
    },
  },
};

/**
 * Product images change fixture
 */
export const productImagesChangedEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'product-images-change-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'images_changed' as const,
    new_values: {
      images_added: ['IMG-002', 'IMG-003'],
      images_removed: ['IMG-001'],
    },
  },
};

/**
 * Product status change fixtures
 */
export const productStatusChangedEvents: Record<string, EventEnvelope> = {
  active: {
    ...validProductUpdatedEvent,
    event_id: 'product-status-active',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'status_changed' as const,
      previous_values: { status: 'draft' },
      new_values: { status: 'active' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'active',
      },
    },
  },
  inactive: {
    ...validProductUpdatedEvent,
    event_id: 'product-status-inactive',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'status_changed' as const,
      previous_values: { status: 'active' },
      new_values: { status: 'inactive' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'inactive',
      },
    },
  },
  draft: {
    ...validProductUpdatedEvent,
    event_id: 'product-status-draft',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'status_changed' as const,
      previous_values: { status: 'active' },
      new_values: { status: 'draft' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'draft',
      },
    },
  },
  archived: {
    ...validProductUpdatedEvent,
    event_id: 'product-status-archived',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'status_changed' as const,
      previous_values: { status: 'inactive' },
      new_values: { status: 'archived' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'archived',
      },
    },
  },
  discontinued: {
    ...validProductUpdatedEvent,
    event_id: 'product-status-discontinued',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'status_changed' as const,
      previous_values: { status: 'inactive' },
      new_values: { status: 'discontinued' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'discontinued',
      },
    },
  },
};

/**
 * Product visibility change fixtures
 */
export const productVisibilityChangedEvents: Record<string, EventEnvelope> = {
  visible: {
    ...validProductUpdatedEvent,
    event_id: 'product-vis-visible',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'visibility_changed' as const,
      previous_values: { visibility: 'hidden' },
      new_values: { visibility: 'visible' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        visibility: 'visible',
      },
    },
  },
  hidden: {
    ...validProductUpdatedEvent,
    event_id: 'product-vis-hidden',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'visibility_changed' as const,
      previous_values: { visibility: 'visible' },
      new_values: { visibility: 'hidden' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        visibility: 'hidden',
      },
    },
  },
  catalog_only: {
    ...validProductUpdatedEvent,
    event_id: 'product-vis-catalog',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'visibility_changed' as const,
      previous_values: { visibility: 'visible' },
      new_values: { visibility: 'catalog_only' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        visibility: 'catalog_only',
      },
    },
  },
  search_only: {
    ...validProductUpdatedEvent,
    event_id: 'product-vis-search',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'visibility_changed' as const,
      previous_values: { visibility: 'visible' },
      new_values: { visibility: 'search_only' },
      product: {
        ...validProductUpdatedEvent.payload.product,
        visibility: 'search_only',
      },
    },
  },
};

/**
 * Product type fixtures
 */
export const productTypeEvents: Record<string, EventEnvelope> = {
  simple: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-simple',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'simple',
      },
    },
  },
  configurable: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-configurable',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'configurable',
        has_variants: true,
        variant_count: 3,
        active_variant_ids: ['VAR-001', 'VAR-002', 'VAR-003'],
      },
    },
  },
  bundle: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-bundle',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'bundle',
      },
    },
  },
  grouped: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-grouped',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'grouped',
      },
    },
  },
  virtual: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-virtual',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'virtual',
        requires_shipping: false,
      },
    },
  },
  downloadable: {
    ...validProductUpdatedEvent,
    event_id: 'product-type-downloadable',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'downloadable',
        requires_shipping: false,
      },
    },
  },
};

/**
 * Bulk product update fixture
 */
export const bulkProductUpdateEvent: EventEnvelope = {
  ...validProductUpdatedEvent,
  event_id: 'bulk-product-update-id',
  payload: {
    ...validProductUpdatedEvent.payload,
    change_type: 'bulk_update' as const,
    previous_values: {
      bulk_operation_id: 'BULK-001',
      products_affected: 100,
    },
    new_values: {
      update_type: 'price_adjustment',
      adjustment_percent: 10,
    },
    variants_affected: Array.from({ length: 10 }, (_, i) => `VAR-${String(i + 1).padStart(3, '0')}`),
    notes: 'Bulk price increase for category',
  },
};

/**
 * Invalid product event fixtures
 */
export const invalidProductEvents = {
  missingProductId: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-no-id',
    payload: {
      ...validProductUpdatedEvent.payload,
      product_id: undefined as any,
    },
  },
  missingSku: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-no-sku',
    payload: {
      ...validProductUpdatedEvent.payload,
      sku: undefined as any,
    },
  },
  invalidChangeType: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-change-type',
    payload: {
      ...validProductUpdatedEvent.payload,
      change_type: 'invalid_type' as any,
    },
  },
  invalidStatus: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-status',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        status: 'invalid' as any,
      },
    },
  },
  invalidVisibility: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-visibility',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        visibility: 'invalid' as any,
      },
    },
  },
  invalidProductType: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-type',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        product_type: 'invalid' as any,
      },
    },
  },
  negativeWeight: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-weight',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        weight: -5,
      },
    },
  },
  invalidWeightUnit: {
    ...validProductUpdatedEvent,
    event_id: 'invalid-product-weight-unit',
    payload: {
      ...validProductUpdatedEvent.payload,
      product: {
        ...validProductUpdatedEvent.payload.product,
        weight: 2.5,
        weight_unit: 'invalid' as any,
      },
    },
  },
};

/**
 * Get all valid product event fixtures
 */
export function getAllValidProductEvents(): EventEnvelope[] {
  return [
    validProductUpdatedEvent,
    productNameChangedEvent,
    productDescriptionChangedEvent,
    productCategoryChangedEvent,
    productAttributesChangedEvent,
    productImagesChangedEvent,
    ...Object.values(productStatusChangedEvents),
    ...Object.values(productVisibilityChangedEvents),
    ...Object.values(productTypeEvents),
    bulkProductUpdateEvent,
  ];
}

/**
 * Get all invalid product event fixtures
 */
export function getAllInvalidProductEvents(): EventEnvelope[] {
  return Object.values(invalidProductEvents);
}
