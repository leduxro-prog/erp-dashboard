/**
 * Webhook Event Transformer
 * Transforms WooCommerce webhook payloads to ERP domain events
 */

import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('webhook-event-transformer');

/**
 * ERP domain event structure for outbox
 */
export interface ERPDomainEvent {
  event_id: string;
  event_type: string;
  event_version: string;
  event_domain: string;
  source_service: string;
  source_entity_type?: string;
  source_entity_id?: string;
  correlation_id?: string;
  causation_id?: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  content_type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  publish_to: string;
  occurred_at: Date;
}

/**
 * WooCommerce order payload
 */
interface WooCommerceOrderPayload {
  id: number;
  order_key: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  total: string;
  subtotal: string;
  total_tax: string;
  total_shipping: string;
  payment_method: string;
  payment_method_title: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    product_id: number;
    variation_id: number;
    quantity: number;
    name: string;
    sku: string;
    price: string;
    subtotal: string;
    total: string;
  }>;
  meta_data: Array<{
    key: string;
    value: any;
  }>;
}

/**
 * WooCommerce product payload
 */
interface WooCommerceProductPayload {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number;
  manage_stock: boolean;
  status: string;
  description: string;
  short_description: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: Array<{
    id: number;
    src: string;
    alt: string;
  }>;
  date_created: string;
  date_modified: string;
  meta_data: Array<{
    key: string;
    value: any;
  }>;
}

/**
 * WooCommerce customer payload
 */
interface WooCommerceCustomerPayload {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  date_created: string;
  date_modified: string;
  meta_data: Array<{
    key: string;
    value: any;
  }>;
}

/**
 * Transformer for WooCommerce webhook events to ERP domain events
 */
export class WebhookEventTransformer {
  /**
   * Transform a WooCommerce webhook payload to an ERP domain event
   */
  transform(topic: string, payload: any, webhookId: string): ERPDomainEvent | null {
    try {
      const correlationId = uuidv4();
      const causationId = webhookId;

      switch (topic) {
        case 'order.created':
          return this.transformOrderCreated(payload, correlationId, causationId);

        case 'order.updated':
          return this.transformOrderUpdated(payload, correlationId, causationId);

        case 'order.deleted':
          return this.transformOrderDeleted(payload, correlationId, causationId);

        case 'product.created':
          return this.transformProductCreated(payload, correlationId, causationId);

        case 'product.updated':
          return this.transformProductUpdated(payload, correlationId, causationId);

        case 'product.deleted':
          return this.transformProductDeleted(payload, correlationId, causationId);

        case 'customer.created':
          return this.transformCustomerCreated(payload, correlationId, causationId);

        case 'customer.updated':
          return this.transformCustomerUpdated(payload, correlationId, causationId);

        case 'customer.deleted':
          return this.transformCustomerDeleted(payload, correlationId, causationId);

        default:
          logger.warn('Unknown webhook topic for transformation', { topic });
          return null;
      }
    } catch (error: any) {
      logger.error('Failed to transform webhook event', {
        topic,
        webhookId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Transform order.created to ERP domain event
   */
  private transformOrderCreated(
    payload: WooCommerceOrderPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const order = payload;
    const eventId = uuidv4();

    // Extract smartbill_id from meta_data if present (for invoice linking)
    const smartbillId = order.meta_data?.find((m) => m.key === 'smartbill_id')?.value;

    return {
      event_id: eventId,
      event_type: 'order.created',
      event_version: '1.0.0',
      event_domain: 'Order',
      source_service: 'woocommerce',
      source_entity_type: 'order',
      source_entity_id: String(order.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_order_id: order.id,
        woo_order_key: order.order_key,
        woo_status: order.status,
        woo_currency: order.currency,
        woo_payment_method: order.payment_method,
        woo_payment_method_title: order.payment_method_title,
        woo_total: parseFloat(order.total),
        woo_subtotal: parseFloat(order.subtotal),
        woo_tax: parseFloat(order.total_tax),
        woo_shipping: parseFloat(order.total_shipping),
        woo_date_created: order.date_created,
        woo_date_modified: order.date_modified,

        // ERP order mapping
        order_number: `WC-${order.id}`,
        customer: {
          woo_customer_id: order.customer_id,
          email: order.billing.email,
          first_name: order.billing.first_name,
          last_name: order.billing.last_name,
          company: order.billing.company,
          phone: order.billing.phone,
          billing_address: order.billing,
          shipping_address: order.shipping,
        },

        // Order items
        items: order.line_items.map((item) => ({
          woo_item_id: item.id,
          woo_product_id: item.product_id,
          woo_variation_id: item.variation_id,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          subtotal: parseFloat(item.subtotal),
          total: parseFloat(item.total),
        })),

        // SmartBill integration
        smartbill_id: smartbillId || null,

        // Raw meta data for additional processing
        meta_data: order.meta_data,
      },
      metadata: {
        woo_webhook_id: causationId,
        woo_order_status: order.status,
        source: 'woocommerce-webhook',
      },
      content_type: 'application/json',
      priority: 'high',
      publish_to: 'event-bus',
      occurred_at: new Date(order.date_created),
    };
  }

  /**
   * Transform order.updated to ERP domain event
   */
  private transformOrderUpdated(
    payload: WooCommerceOrderPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const event = this.transformOrderCreated(payload, correlationId, causationId);
    event.event_type = 'order.updated';
    event.priority = 'normal';
    return event;
  }

  /**
   * Transform order.deleted to ERP domain event
   */
  private transformOrderDeleted(
    payload: WooCommerceOrderPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const order = payload;
    const eventId = uuidv4();

    return {
      event_id: eventId,
      event_type: 'order.cancelled',
      event_version: '1.0.0',
      event_domain: 'Order',
      source_service: 'woocommerce',
      source_entity_type: 'order',
      source_entity_id: String(order.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_order_id: order.id,
        woo_order_key: order.order_key,
        woo_status: order.status,
        order_number: `WC-${order.id}`,
      },
      metadata: {
        woo_webhook_id: causationId,
        source: 'woocommerce-webhook',
        reason: 'deleted_in_woocommerce',
      },
      content_type: 'application/json',
      priority: 'high',
      publish_to: 'event-bus',
      occurred_at: new Date(),
    };
  }

  /**
   * Transform product.created to ERP domain event
   */
  private transformProductCreated(
    payload: WooCommerceProductPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const product = payload;
    const eventId = uuidv4();

    return {
      event_id: eventId,
      event_type: 'product.created',
      event_version: '1.0.0',
      event_domain: 'Catalog',
      source_service: 'woocommerce',
      source_entity_type: 'product',
      source_entity_id: String(product.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_product_id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: parseFloat(product.price) || 0,
        regular_price: parseFloat(product.regular_price) || 0,
        sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
        stock_quantity: product.stock_quantity || 0,
        manage_stock: product.manage_stock,
        status: product.status,
        description: product.description,
        short_description: product.short_description,
        categories: product.categories.map((cat) => ({
          woo_category_id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
        images: product.images.map((img) => ({
          woo_image_id: img.id,
          src: img.src,
          alt: img.alt,
        })),
        woo_date_created: product.date_created,
        woo_date_modified: product.date_modified,
        meta_data: product.meta_data,
      },
      metadata: {
        woo_webhook_id: causationId,
        source: 'woocommerce-webhook',
      },
      content_type: 'application/json',
      priority: 'normal',
      publish_to: 'event-bus',
      occurred_at: new Date(product.date_created),
    };
  }

  /**
   * Transform product.updated to ERP domain event
   */
  private transformProductUpdated(
    payload: WooCommerceProductPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const event = this.transformProductCreated(payload, correlationId, causationId);
    event.event_type = 'product.updated';
    event.priority = 'normal';
    return event;
  }

  /**
   * Transform product.deleted to ERP domain event
   */
  private transformProductDeleted(
    payload: WooCommerceProductPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const product = payload;
    const eventId = uuidv4();

    return {
      event_id: eventId,
      event_type: 'product.archived',
      event_version: '1.0.0',
      event_domain: 'Catalog',
      source_service: 'woocommerce',
      source_entity_type: 'product',
      source_entity_id: String(product.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_product_id: product.id,
        name: product.name,
        sku: product.sku,
      },
      metadata: {
        woo_webhook_id: causationId,
        source: 'woocommerce-webhook',
        reason: 'deleted_in_woocommerce',
      },
      content_type: 'application/json',
      priority: 'normal',
      publish_to: 'event-bus',
      occurred_at: new Date(),
    };
  }

  /**
   * Transform customer.created to ERP domain event
   */
  private transformCustomerCreated(
    payload: WooCommerceCustomerPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const customer = payload;
    const eventId = uuidv4();

    return {
      event_id: eventId,
      event_type: 'customer.created',
      event_version: '1.0.0',
      event_domain: 'Customer',
      source_service: 'woocommerce',
      source_entity_type: 'customer',
      source_entity_id: String(customer.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_customer_id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        username: customer.username,
        billing_address: customer.billing,
        shipping_address: customer.shipping,
        woo_date_created: customer.date_created,
        woo_date_modified: customer.date_modified,
        meta_data: customer.meta_data,
      },
      metadata: {
        woo_webhook_id: causationId,
        source: 'woocommerce-webhook',
      },
      content_type: 'application/json',
      priority: 'normal',
      publish_to: 'event-bus',
      occurred_at: new Date(customer.date_created),
    };
  }

  /**
   * Transform customer.updated to ERP domain event
   */
  private transformCustomerUpdated(
    payload: WooCommerceCustomerPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const event = this.transformCustomerCreated(payload, correlationId, causationId);
    event.event_type = 'customer.updated';
    event.priority = 'low';
    return event;
  }

  /**
   * Transform customer.deleted to ERP domain event
   */
  private transformCustomerDeleted(
    payload: WooCommerceCustomerPayload,
    correlationId: string,
    causationId: string
  ): ERPDomainEvent {
    const customer = payload;
    const eventId = uuidv4();

    return {
      event_id: eventId,
      event_type: 'customer.deleted',
      event_version: '1.0.0',
      event_domain: 'Customer',
      source_service: 'woocommerce',
      source_entity_type: 'customer',
      source_entity_id: String(customer.id),
      correlation_id: correlationId,
      causation_id: causationId,
      payload: {
        woo_customer_id: customer.id,
        email: customer.email,
      },
      metadata: {
        woo_webhook_id: causationId,
        source: 'woocommerce-webhook',
        reason: 'deleted_in_woocommerce',
      },
      content_type: 'application/json',
      priority: 'normal',
      publish_to: 'event-bus',
      occurred_at: new Date(),
    };
  }
}
