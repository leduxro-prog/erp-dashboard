import { ProductSyncMapping } from '../../domain/entities/ProductSyncMapping';
import {
  CreateProductPayload,
  UpdateProductPayload,
  PulledOrder,
  WooCommerceProduct,
} from '../../application/dtos/woocommerce.dtos';
import { WooCommerceOrder } from '../api-client/WooCommerceApiClient';

export interface InternalProduct {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  sku: string;
  price: number;
  salePrice?: number;
  salePriceStartDate?: Date;
  salePriceEndDate?: Date;
  categories?: string[];
  images?: Array<{
    url: string;
    alt?: string;
    name?: string;
  }>;
  attributes?: Array<{
    name: string;
    values: string[];
  }>;
  status: 'active' | 'inactive' | 'draft';
  stockQuantity?: number;
}

export class WooCommerceMapper {
  toWooCommerceProduct(
    product: InternalProduct,
    mapping?: ProductSyncMapping
  ): CreateProductPayload | UpdateProductPayload {
    const basePayload = {
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription || '',
      regularPrice: product.price.toString(),
      salePrice: product.salePrice ? product.salePrice.toString() : undefined,
      images: this.mapImages(product.images),
      categories: this.mapCategories(product.categories),
      status: this.mapStatus(product.status),
      stockQuantity: product.stockQuantity,
    };

    if (mapping) {
      return {
        id: mapping.wooCommerceProductId,
        ...basePayload,
      } as UpdateProductPayload;
    }

    return {
      sku: product.sku,
      manageStock: true,
      ...basePayload,
    } as CreateProductPayload;
  }

  toWooCommerceStock(productId: number, quantity: number): any {
    return {
      manage_stock: true,
      stock_quantity: quantity,
      in_stock: quantity > 0,
    };
  }

  toWooCommercePrice(
    productId: number,
    price: number,
    salePrice?: number,
    salePriceStartDate?: Date,
    salePriceEndDate?: Date
  ): any {
    const payload: any = {
      regular_price: price.toString(),
    };

    if (salePrice !== undefined && salePrice > 0) {
      payload.sale_price = salePrice.toString();

      if (salePriceStartDate) {
        payload.date_on_sale_from = salePriceStartDate.toISOString();
      }

      if (salePriceEndDate) {
        payload.date_on_sale_to = salePriceEndDate.toISOString();
      }
    } else {
      payload.sale_price = '';
      payload.date_on_sale_from = null;
      payload.date_on_sale_to = null;
    }

    return payload;
  }

  fromWooCommerceOrder(wcOrder: WooCommerceOrder): PulledOrder {
    return {
      id: wcOrder.id,
      orderNumber: wcOrder.number,
      customerId: wcOrder.customer_id,
      customerEmail: wcOrder.billing.email,
      customerName: `${wcOrder.billing.first_name} ${wcOrder.billing.last_name}`,
      status: wcOrder.status,
      total: wcOrder.total,
      currency: wcOrder.currency,
      paymentMethod: wcOrder.payment_method,
      shippingTotal: wcOrder.shipping_total,
      taxTotal: wcOrder.total_tax,
      subtotal: wcOrder.subtotal,
      items: wcOrder.line_items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        variationId: item.variation_id,
        quantity: item.quantity,
        taxClass: item.tax_class,
        subtotal: item.subtotal,
        subtotalTax: item.subtotal_tax,
        total: item.total,
        totalTax: item.total_tax,
        sku: item.sku,
        price: item.price,
        name: item.name,
      })),
      shippingAddress: {
        firstName: wcOrder.shipping.first_name,
        lastName: wcOrder.shipping.last_name,
        company: wcOrder.shipping.company,
        address1: wcOrder.shipping.address_1,
        address2: wcOrder.shipping.address_2,
        city: wcOrder.shipping.city,
        state: wcOrder.shipping.state,
        postcode: wcOrder.shipping.postcode,
        country: wcOrder.shipping.country,
      },
      billingAddress: {
        firstName: wcOrder.billing.first_name,
        lastName: wcOrder.billing.last_name,
        company: wcOrder.billing.company,
        email: wcOrder.billing.email,
        phone: wcOrder.billing.phone,
        address1: wcOrder.billing.address_1,
        address2: wcOrder.billing.address_2,
        city: wcOrder.billing.city,
        state: wcOrder.billing.state,
        postcode: wcOrder.billing.postcode,
        country: wcOrder.billing.country,
      },
      datePaid: wcOrder.date_paid ? new Date(wcOrder.date_paid) : undefined,
      dateCreated: new Date(wcOrder.date_created),
      dateModified: new Date(wcOrder.date_modified),
    };
  }

  private mapImages(
    images?: Array<{ url: string; alt?: string; name?: string }>
  ): Array<{ src: string; alt?: string; name?: string }> {
    if (!images || images.length === 0) {
      return [];
    }

    return images.map((img) => ({
      src: img.url,
      alt: img.alt,
      name: img.name,
    }));
  }

  private mapCategories(
    categories?: string[]
  ): Array<{ id: number }> {
    if (!categories || categories.length === 0) {
      return [];
    }

    // This is a simplified mapping - in production, you'd maintain
    // a mapping between internal category IDs and WooCommerce category IDs
    return categories.map((cat, index) => ({
      id: parseInt(cat, 10) || index + 1,
    }));
  }

  private mapStatus(
    status: 'active' | 'inactive' | 'draft'
  ): string {
    switch (status) {
      case 'active':
        return 'publish';
      case 'draft':
        return 'draft';
      case 'inactive':
        return 'private';
      default:
        return 'draft';
    }
  }
}
