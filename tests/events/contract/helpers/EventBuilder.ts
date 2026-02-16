/**
 * @file Event Builder Helper
 * @module tests/events/contract/helpers/EventBuilder
 * @description Builder pattern for creating test event envelopes with
 * realistic payloads for contract testing.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EventEnvelope,
  EventEnvelopeOptions,
  EventPriority,
  EventMetadata,
} from '../../../../events/types/EventEnvelope';

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = removeUndefinedDeep(child);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result as T;
  }

  return value;
}

/**
 * Builder options for creating test events
 */
export interface EventBuilderOptions {
  event_type: string;
  event_version?: string;
  producer?: string;
  producer_version?: string;
  correlation_id?: string;
  causation_id?: string;
  trace_id?: string;
  priority?: EventPriority;
  occurred_at?: string;
}

/**
 * Test event builder with fluent API
 *
 * @example
 * ```typescript
 * const event = new EventBuilder('order.created', 'order-service')
 *   .withCustomer('CUST-123', 'b2b')
 *   .withItems([
 *     { product_id: 'PRD-1', quantity: 10, unit_price: 100 }
 *   ])
 *   .withTotals({ subtotal: 1000, tax: 190, total: 1190 })
 *   .build();
 * ```
 */
export class EventBuilder {
  private eventType: string;
  private producer: string;
  private eventVersion: string = 'v1';
  private producerVersion: string = '1.0.0';
  private correlationId: string;
  private causationId?: string;
  private traceId?: string;
  private priority: EventPriority = EventPriority.NORMAL;
  private occurredAt: string;
  private metadata: EventMetadata = {};
  private payload: Record<string, any> = {};

  constructor(eventType: string, producer: string) {
    this.eventType = eventType;
    this.producer = producer;
    this.correlationId = uuidv4();
    this.traceId = this.correlationId;
    this.occurredAt = new Date().toISOString();
  }

  public static createOrderNumber(): string {
    const randomNumber = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, '0');
    return `ORD-${randomNumber}`;
  }

  public static createQuoteNumber(): string {
    const randomNumber = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `QT-${randomNumber}`;
  }

  /**
   * Set event version
   */
  public withVersion(version: string): EventBuilder {
    this.eventVersion = version;
    return this;
  }

  /**
   * Set producer version
   */
  public withProducerVersion(version: string): EventBuilder {
    this.producerVersion = version;
    return this;
  }

  /**
   * Set correlation ID
   */
  public withCorrelationId(id: string): EventBuilder {
    this.correlationId = id;
    this.traceId = id;
    return this;
  }

  /**
   * Set causation ID
   */
  public withCausationId(id: string): EventBuilder {
    this.causationId = id;
    return this;
  }

  /**
   * Set trace ID
   */
  public withTraceId(id: string): EventBuilder {
    this.traceId = id;
    return this;
  }

  /**
   * Set priority level
   */
  public withPriority(priority: EventPriority): EventBuilder {
    this.priority = priority;
    return this;
  }

  /**
   * Set occurred at timestamp
   */
  public withOccurredAt(timestamp: string): EventBuilder {
    this.occurredAt = timestamp;
    return this;
  }

  /**
   * Add metadata
   */
  public withMetadata(metadata: EventMetadata): EventBuilder {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  /**
   * Set user ID in metadata
   */
  public withUser(userId: string): EventBuilder {
    this.metadata.user_id = userId;
    return this;
  }

  /**
   * Set session ID in metadata
   */
  public withSession(sessionId: string): EventBuilder {
    this.metadata.session_id = sessionId;
    return this;
  }

  /**
   * Set tenant ID in metadata
   */
  public withTenant(tenantId: string): EventBuilder {
    this.metadata.tenant_id = tenantId;
    return this;
  }

  /**
   * Add custom payload field
   */
  public withPayloadField(key: string, value: any): EventBuilder {
    if (this.eventType === 'product.updated' && (key === 'dimensions' || key === 'attributes')) {
      const currentProduct =
        this.payload.product && typeof this.payload.product === 'object'
          ? this.payload.product
          : {};
      this.payload.product = {
        ...currentProduct,
        [key]: value,
      };
      return this;
    }

    this.payload[key] = value;
    return this;
  }

  /**
   * Set entire payload
   */
  public withPayload(payload: Record<string, any>): EventBuilder {
    this.payload = { ...this.payload, ...payload };
    return this;
  }

  /**
   * Build order.created event payload
   */
  public withOrder(order: {
    order_id?: string;
    order_number?: string;
    customer_id?: string;
    customer_type?: 'b2b' | 'b2c' | 'guest';
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    created_by?: string;
    created_at?: string;
    status?: string;
    payment_status?: string;
    fulfillment_status?: string;
    items?: Array<{
      item_id?: string;
      product_id: string;
      variant_id?: string;
      sku?: string;
      product_name?: string;
      quantity: number;
      unit_price: number;
      unit_cost?: number;
      tax_rate?: number;
      tax_amount?: number;
      discount_amount?: number;
      line_total?: number;
      [key: string]: any;
    }>;
    totals?: {
      subtotal: number;
      discount_amount?: number;
      tax_amount: number;
      shipping_amount?: number;
      shipping_discount?: number;
      total: number;
      currency?: string;
      [key: string]: any;
    };
    shipping_address?: {
      name?: string;
      company?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state_province?: string;
      postal_code?: string;
      country: string;
      phone?: string;
      [key: string]: any;
    };
    billing_address?: Record<string, any>;
    shipping_method?: {
      method_code: string;
      method_name: string;
      cost: number;
      estimated_days?: number;
      carrier?: string;
    };
    payment_method?: {
      method_code: string;
      method_name: string;
      installments?: number;
      payment_term?: string;
    };
    channel?: string;
    notes?: string;
    internal_notes?: string;
    promo_code?: string;
    tax_exempt?: boolean;
    metadata?: Record<string, any>;
    [key: string]: any;
  }): EventBuilder {
    const existingPayload = this.payload as Record<string, any>;
    const normalizedItems = (order.items ?? existingPayload.items ?? []).map(
      (item: Record<string, any>) => ({
        ...item,
        item_id: item.item_id ?? uuidv4(),
      }),
    );

    const normalizedOrderNumber =
      typeof order.order_number === 'string' && /^ORD-\d{1,7}$/.test(order.order_number)
        ? `ORD-${order.order_number.slice(4).padStart(8, '0')}`
        : order.order_number;

    this.payload = {
      order_id: order.order_id ?? existingPayload.order_id ?? uuidv4(),
      order_number:
        normalizedOrderNumber ?? existingPayload.order_number ?? EventBuilder.createOrderNumber(),
      customer_id: order.customer_id ?? existingPayload.customer_id ?? 'CUST-DEFAULT',
      customer_type: order.customer_type ?? existingPayload.customer_type ?? 'b2c',
      customer_name: order.customer_name ?? existingPayload.customer_name ?? 'Test Customer',
      customer_email: order.customer_email ?? existingPayload.customer_email ?? 'test@example.com',
      customer_phone: order.customer_phone,
      created_by: order.created_by,
      created_at: order.created_at ?? this.occurredAt,
      status: order.status ?? existingPayload.status ?? 'pending',
      payment_status: order.payment_status ?? existingPayload.payment_status ?? 'pending',
      fulfillment_status:
        order.fulfillment_status ?? existingPayload.fulfillment_status ?? 'unfulfilled',
      items: normalizedItems,
      totals: order.totals ||
        existingPayload.totals || {
          subtotal: 0,
          tax_amount: 0,
          total: 0,
          currency: 'EUR',
        },
      shipping_address: order.shipping_address ||
        existingPayload.shipping_address || {
          city: 'Bucharest',
          country: 'Romania',
        },
      billing_address: order.billing_address,
      shipping_method: order.shipping_method,
      payment_method: order.payment_method,
      channel: order.channel ?? 'web',
      notes: order.notes,
      internal_notes: order.internal_notes,
      promo_code: order.promo_code,
      tax_exempt: order.tax_exempt ?? false,
      metadata: order.metadata,
    };
    return this;
  }

  /**
   * Build product.updated event payload
   */
  public withProduct(product: {
    product_id?: string;
    sku?: string;
    change_type?:
      | 'name_changed'
      | 'description_changed'
      | 'category_changed'
      | 'attributes_changed'
      | 'images_changed'
      | 'status_changed'
      | 'visibility_changed'
      | 'active_variant_changed'
      | 'metadata_changed'
      | 'bulk_update';
    updated_by?: string;
    previous_values?: Record<string, any>;
    new_values?: Record<string, any>;
    product_state?: {
      name: string;
      status: string;
      visibility?: string;
      category_id?: string;
      brand_name?: string;
    };
    variants_affected?: string[];
    notes?: string;
    metadata?: Record<string, any>;
  }): EventBuilder {
    this.payload = {
      product_id: product.product_id ?? 'PRD-DEFAULT',
      sku: product.sku ?? product.product_id ?? 'PRD-DEFAULT',
      updated_at: this.occurredAt,
      updated_by: product.updated_by,
      change_type: product.change_type ?? 'name_changed',
      previous_values: product.previous_values,
      new_values: product.new_values,
      product: product.product_state || {
        name: 'Test Product',
        status: 'active',
      },
      variants_affected: product.variants_affected,
      notes: product.notes,
      metadata: product.metadata,
    };
    return this;
  }

  /**
   * Build stock.changed event payload
   */
  public withStock(stock: {
    product_id?: string;
    sku?: string;
    location_id?: string;
    change_type?: 'addition' | 'removal' | 'adjustment' | 'transfer' | 'reserved' | 'released';
    quantity_change?: number;
    quantity_before?: number;
    quantity_after?: number;
    reason?: string;
    reference_id?: string;
    reference_type?: string;
    performed_by?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): EventBuilder {
    const quantityChange = stock.quantity_change ?? 0;
    const quantityBefore = stock.quantity_before ?? 100;
    const quantityAfter = stock.quantity_after ?? quantityBefore + quantityChange;
    const changeTypeMap: Record<string, string> = {
      addition: 'manual_adjustment',
      removal: 'order_shipped',
      adjustment: 'manual_adjustment',
      transfer: 'transfer_sent',
      reserved: 'order_reserved',
      released: 'order_released',
    };
    const mappedChangeType =
      changeTypeMap[(stock.change_type as string) || ''] ??
      stock.change_type ??
      'manual_adjustment';

    this.payload = {
      product_id: stock.product_id ?? 'PRD-DEFAULT',
      sku: stock.sku ?? stock.product_id ?? 'PRD-DEFAULT',
      location_id: stock.location_id ?? 'LOC-DEFAULT',
      changed_at: this.occurredAt,
      change_type: mappedChangeType,
      quantity_change: quantityChange,
      previous_quantity: quantityBefore,
      new_quantity: quantityAfter,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      reason: stock.reason,
      reference_id: stock.reference_id,
      reference_type: stock.reference_type,
      changed_by: stock.performed_by,
      performed_by: stock.performed_by,
      notes: stock.notes,
      metadata: stock.metadata,
    };
    return this;
  }

  /**
   * Build price.changed event payload
   */
  public withPrice(price: {
    product_id?: string;
    sku?: string;
    price_type?: 'regular' | 'special' | 'tier' | 'bulk' | 'b2b';
    currency?: string;
    price_before?: number;
    price_after: number;
    change_reason?: string;
    effective_from?: string;
    effective_until?: string;
    tier_id?: string;
    tier_name?: string;
    minimum_quantity?: number;
    customer_group?: string;
    changed_by?: string;
    metadata?: Record<string, any>;
  }): EventBuilder {
    const priceTypeMap: Record<string, string> = {
      regular: 'base_price',
      special: 'sale_price',
      tier: 'tier_price',
      bulk: 'bulk_discount',
      b2b: 'group_price',
    };
    const mappedPriceType =
      priceTypeMap[(price.price_type as string) || ''] ?? price.price_type ?? 'base_price';

    this.payload = {
      product_id: price.product_id ?? 'PRD-DEFAULT',
      sku: price.sku ?? price.product_id ?? 'PRD-DEFAULT',
      changed_at: this.occurredAt,
      price_type: mappedPriceType,
      currency: price.currency ?? 'EUR',
      previous_price: price.price_before,
      new_price: price.price_after,
      price: price.price_after,
      price_before: price.price_before,
      price_after: price.price_after,
      change_reason: price.change_reason,
      effective_from: price.effective_from || this.occurredAt,
      effective_until: price.effective_until,
      tier_id: price.tier_id,
      tier_name: price.tier_name,
      minimum_quantity: price.minimum_quantity,
      customer_group: price.customer_group,
      changed_by: price.changed_by,
      metadata: price.metadata,
    };
    return this;
  }

  /**
   * Build cart.updated event payload
   */
  public withCart(cart: {
    cart_id?: string;
    customer_id?: string;
    customer_type?: 'b2b' | 'b2c' | 'guest';
    session_id?: string;
    items?: Array<{
      item_id?: string;
      product_id: string;
      variant_id?: string;
      sku?: string;
      quantity: number;
      unit_price: number;
    }>;
    totals?: {
      subtotal: number;
      discount_amount?: number;
      tax_amount?: number;
      total?: number;
      currency?: string;
    };
    applied_promo_codes?: string[];
    estimated_shipping?: number;
    metadata?: Record<string, any>;
  }): EventBuilder {
    const normalizedItems = (cart.items || []).map((item) => ({
      ...item,
      item_id: item.item_id ?? uuidv4(),
      variant_id: item.variant_id ?? 'VAR-DEFAULT',
    }));
    const subtotal = cart.totals?.subtotal ?? 0;
    const taxAmount = cart.totals?.tax_amount ?? 0;
    const total = cart.totals?.total ?? subtotal + taxAmount;

    this.payload = {
      cart_id: cart.cart_id ?? uuidv4(),
      user_id: cart.customer_id ?? `guest-${cart.session_id ?? 'anonymous'}`,
      customer_id: cart.customer_id,
      customer_type: cart.customer_type ?? 'guest',
      session_id: cart.session_id,
      action: 'item_added',
      updated_at: this.occurredAt,
      items: normalizedItems,
      totals: {
        subtotal,
        tax_amount: taxAmount,
        total,
        discount_amount: cart.totals?.discount_amount,
        currency: cart.totals?.currency ?? 'EUR',
      },
      applied_promo_codes: cart.applied_promo_codes || [],
      estimated_shipping: cart.estimated_shipping,
      metadata: cart.metadata,
    };
    return this;
  }

  /**
   * Build quote.created event payload
   */
  public withQuote(quote: {
    quote_id?: string;
    quote_number?: string;
    customer_id?: string;
    customer_type?: 'b2b' | 'b2c' | 'guest';
    customer_name?: string;
    customer_email?: string;
    created_by?: string;
    expires_at?: string;
    status?: string;
    items?: Array<{
      item_id?: string;
      product_id: string;
      quantity: number;
      unit_price: number;
    }>;
    totals?: {
      subtotal: number;
      discount_amount?: number;
      tax_amount?: number;
      total: number;
      currency?: string;
    };
    notes?: string;
    internal_notes?: string;
    metadata?: Record<string, any>;
  }): EventBuilder {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const normalizedItems = (quote.items || []).map((item) => ({
      ...item,
      item_id: item.item_id ?? uuidv4(),
    }));
    const statusMap: Record<string, string> = {
      pending: 'draft',
    };
    const mappedStatus = statusMap[(quote.status as string) || ''] ?? quote.status ?? 'draft';

    this.payload = {
      quote_id: quote.quote_id ?? uuidv4(),
      quote_number: quote.quote_number ?? EventBuilder.createQuoteNumber(),
      customer_id: quote.customer_id ?? 'CUST-DEFAULT',
      customer_type: quote.customer_type ?? 'b2b',
      customer_name: quote.customer_name ?? 'Test Customer',
      customer_email: quote.customer_email ?? 'test@example.com',
      created_by: quote.created_by,
      created_at: this.occurredAt,
      valid_until: quote.expires_at ?? validUntil.toISOString(),
      expires_at: quote.expires_at ?? validUntil.toISOString(),
      status: mappedStatus,
      items: normalizedItems,
      totals: quote.totals || {
        subtotal: 0,
        tax_amount: 0,
        total: 0,
        currency: 'EUR',
      },
      notes: quote.notes,
      internal_notes: quote.internal_notes,
      metadata: quote.metadata,
    };
    return this;
  }

  /**
   * Build credit.changed event payload
   */
  public withCredit(credit: {
    customer_id?: string;
    credit_limit_before?: number;
    credit_limit_after?: number;
    credit_used_before?: number;
    credit_used_after?: number;
    available_before?: number;
    available_after?: number;
    change_type?: 'limit_updated' | 'payment_received' | 'order_placed' | 'manual_adjustment';
    reason?: string;
    reference_id?: string;
    reference_type?: string;
    performed_by?: string;
    metadata?: Record<string, any>;
  }): EventBuilder {
    const changeTypeMap: Record<string, string> = {
      limit_updated: 'credit_limit_set',
      payment_received: 'payment_received',
      order_placed: 'balance_increased',
      manual_adjustment: 'balance_decreased',
    };
    const mappedChangeType =
      changeTypeMap[(credit.change_type as string) || ''] ??
      credit.change_type ??
      'credit_limit_set';
    const creditLimit = credit.credit_limit_after ?? credit.credit_limit_before ?? 0;
    const balance = credit.credit_used_after ?? credit.credit_used_before ?? 0;
    const availableCredit = credit.available_after ?? Math.max(creditLimit - balance, 0);

    this.payload = {
      customer_id: credit.customer_id ?? 'CUST-DEFAULT',
      customer_type: 'b2b',
      previous_credit_limit: credit.credit_limit_before,
      new_credit_limit: credit.credit_limit_after,
      credit_limit: creditLimit,
      previous_balance: credit.credit_used_before ?? 0,
      new_balance: credit.credit_used_after ?? 0,
      balance,
      available_credit: availableCredit,
      changed_at: this.occurredAt,
      change_type: mappedChangeType,
      reason: credit.reason,
      reference_id: credit.reference_id,
      reference_type: credit.reference_type,
      changed_by: credit.performed_by,
      performed_by: credit.performed_by,
      metadata: credit.metadata,
    };
    return this;
  }

  /**
   * Build the final event envelope
   */
  public build(): EventEnvelope {
    const cleanedPayload = removeUndefinedDeep(this.payload);
    const cleanedMetadata = removeUndefinedDeep(this.metadata);

    return {
      event_id: uuidv4(),
      event_type: this.eventType,
      event_version: this.eventVersion,
      occurred_at: this.occurredAt,
      producer: this.producer,
      producer_version: this.producerVersion,
      correlation_id: this.correlationId,
      causation_id: this.causationId,
      trace_id: this.traceId,
      routing_key: `${this.eventType}.${this.eventVersion}`,
      priority: this.priority,
      payload: cleanedPayload,
      metadata: Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : undefined,
    };
  }

  /**
   * Create a minimal valid event envelope for testing
   */
  public static minimal(eventType: string, payload: Record<string, any> = {}): EventEnvelope {
    return new EventBuilder(eventType, 'test-producer').withPayload(payload).build();
  }
}

/**
 * Factory for creating test event builders
 */
export class EventBuilderFactory {
  /**
   * Create a new EventBuilder instance
   */
  public static create(eventType: string, producer: string = 'test-service'): EventBuilder {
    return new EventBuilder(eventType, producer);
  }

  /**
   * Create an order event builder
   */
  public static order(orderNumber?: string): EventBuilder {
    return new EventBuilder('order.created', 'order-service').withPayloadField(
      'order_number',
      orderNumber ?? EventBuilder.createOrderNumber(),
    );
  }

  /**
   * Create a product event builder
   */
  public static product(productId: string = 'PRD-001'): EventBuilder {
    return new EventBuilder('product.updated', 'product-service').withPayloadField(
      'product_id',
      productId,
    );
  }

  /**
   * Create a stock event builder
   */
  public static stock(productId: string = 'PRD-001'): EventBuilder {
    return new EventBuilder('stock.changed', 'inventory-service').withPayloadField(
      'product_id',
      productId,
    );
  }

  /**
   * Create a price event builder
   */
  public static price(productId: string = 'PRD-001'): EventBuilder {
    return new EventBuilder('price.changed', 'pricing-service').withPayloadField(
      'product_id',
      productId,
    );
  }

  /**
   * Create a cart event builder
   */
  public static cart(cartId?: string): EventBuilder {
    return new EventBuilder('cart.updated', 'cart-service').withPayloadField(
      'cart_id',
      cartId ?? uuidv4(),
    );
  }

  /**
   * Create a quote event builder
   */
  public static quote(quoteNumber?: string): EventBuilder {
    return new EventBuilder('quote.created', 'quote-service').withPayloadField(
      'quote_number',
      quoteNumber ?? EventBuilder.createQuoteNumber(),
    );
  }

  /**
   * Create a credit event builder
   */
  public static credit(customerId: string = 'CUST-001'): EventBuilder {
    return new EventBuilder('credit.changed', 'credit-service').withPayloadField(
      'customer_id',
      customerId,
    );
  }
}

/**
 * Create a batch of related events with same correlation ID
 */
export function createEventBatch(
  configs: Array<{ eventType: string; producer: string; payload: Record<string, any> }>,
  correlationId?: string,
): EventEnvelope[] {
  const corrId = correlationId || uuidv4();
  const traceId = corrId;

  return configs.map((config, index) => {
    return new EventBuilder(config.eventType, config.producer)
      .withCorrelationId(corrId)
      .withTraceId(traceId)
      .withPayload(config.payload)
      .build();
  });
}

/**
 * Create a parent-child event chain
 */
export function createEventChain(
  parent: { eventType: string; producer: string; payload: Record<string, any> },
  children: Array<{ eventType: string; producer: string; payload: Record<string, any> }>,
): { parent: EventEnvelope; children: EventEnvelope[] } {
  const parentEvent = new EventBuilder(parent.eventType, parent.producer)
    .withPayload(parent.payload)
    .build();

  const childEvents = children.map((child) => {
    return new EventBuilder(child.eventType, child.producer)
      .withCorrelationId(parentEvent.correlation_id)
      .withTraceId(parentEvent.trace_id || parentEvent.event_id)
      .withCausationId(parentEvent.event_id)
      .withPayload(child.payload)
      .build();
  });

  return { parent: parentEvent, children: childEvents };
}
