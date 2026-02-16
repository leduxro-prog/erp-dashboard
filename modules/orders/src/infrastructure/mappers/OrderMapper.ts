import { Injectable } from '@nestjs/common';
import { OrderEntity, OrderStatus, PaymentStatus } from '../entities/OrderEntity';

// Domain model (simplified)
export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  grand_total: number;
  currency: string;
  payment_terms: string;
  payment_status: string;
  proforma_number: string | null;
  invoice_number: string | null;
  notes: string | null;
  billing_address: Record<string, any> | null;
  shipping_address: Record<string, any> | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  items?: any[];
  status_history?: any[];
}

export interface OrderSummaryResult {
  id: string;
  order_number: string;
  customer_name: string;
  status: OrderStatus;
  grand_total: number;
  currency: string;
  created_at: Date;
  payment_status: string;
}

export interface OrderDetailResult {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  grand_total: number;
  currency: string;
  payment_terms: string;
  payment_status: string;
  proforma_number: string | null;
  invoice_number: string | null;
  notes: string | null;
  billing_address: Record<string, any> | null;
  shipping_address: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
  items: any[];
  status_history: any[];
}

@Injectable()
export class OrderMapper {
  toDomain(entity: OrderEntity): Order {
    return {
      id: entity.id,
      order_number: entity.order_number,
      customer_id: entity.customer_id,
      customer_name: entity.customer_name,
      customer_email: entity.customer_email,
      status: entity.status,
      subtotal: Number(entity.subtotal),
      discount_amount: Number(entity.discount_amount),
      tax_rate: Number(entity.tax_rate),
      tax_amount: Number(entity.tax_amount),
      shipping_cost: Number(entity.shipping_cost),
      grand_total: Number(entity.grand_total),
      currency: entity.currency,
      payment_terms: entity.payment_terms,
      payment_status: entity.payment_status,
      proforma_number: entity.proforma_number,
      invoice_number: entity.invoice_number,
      notes: entity.notes,
      billing_address: entity.billing_address,
      shipping_address: entity.shipping_address,
      created_by: entity.created_by,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      items: entity.items || [],
      status_history: entity.status_history || [],
    };
  }

  toEntity(order: Order): Partial<OrderEntity> {
    return {
      id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      status: order.status,
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      tax_rate: order.tax_rate,
      tax_amount: order.tax_amount,
      shipping_cost: order.shipping_cost,
      grand_total: order.grand_total,
      currency: order.currency,
      payment_terms: order.payment_terms,
      payment_status: order.payment_status as PaymentStatus,
      proforma_number: order.proforma_number,
      invoice_number: order.invoice_number,
      notes: order.notes,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      created_by: order.created_by,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }

  toSummaryDTO(order: Order): OrderSummaryResult {
    return {
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      status: order.status,
      grand_total: order.grand_total,
      currency: order.currency,
      created_at: order.created_at,
      payment_status: order.payment_status,
    };
  }

  toDetailDTO(order: Order): OrderDetailResult {
    return {
      id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      status: order.status,
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      tax_rate: order.tax_rate,
      tax_amount: order.tax_amount,
      shipping_cost: order.shipping_cost,
      grand_total: order.grand_total,
      currency: order.currency,
      payment_terms: order.payment_terms,
      payment_status: order.payment_status,
      proforma_number: order.proforma_number,
      invoice_number: order.invoice_number,
      notes: order.notes,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.items || [],
      status_history: order.status_history || [],
    };
  }
}
