/**
 * Order Factory
 * Generates test order data for integration tests.
 */

import {
  OrderStatus,
  PaymentStatus,
} from '../../../modules/orders/src/infrastructure/entities/OrderEntity';

let orderCounter = 0;

export interface CreateOrderInput {
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  items?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export function createOrderData(input: CreateOrderInput = {}) {
  orderCounter++;
  const orderNumber = `ORD-TEST-${String(orderCounter).padStart(4, '0')}`;

  const items = input.items || [
    {
      productId: 'prod-test-001',
      productName: 'Test Product',
      quantity: 2,
      unitPrice: 100,
    },
  ];

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxRate = 0.21;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  return {
    order: {
      order_number: orderNumber,
      customer_id: input.customerId || '00000000-0000-0000-0000-000000000001',
      customer_name: input.customerName || 'Test Customer',
      customer_email: input.customerEmail || 'test@example.com',
      status: input.status || OrderStatus.ORDER_CONFIRMED,
      payment_status: input.paymentStatus || PaymentStatus.UNPAID,
      subtotal,
      discount_amount: 0,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      shipping_cost: 0,
      grand_total: grandTotal,
      currency: 'RON',
      payment_terms: 'NET30',
      billing_address: {
        name: 'Test Customer',
        street: 'Test Street 123',
        city: 'Bucharest',
        county: 'Bucharest',
        postalCode: '010101',
        country: 'Romania',
      },
      shipping_address: {
        name: 'Test Customer',
        street: 'Test Street 123',
        city: 'Bucharest',
        county: 'Bucharest',
        postalCode: '010101',
        country: 'Romania',
      },
      created_by: 'test-user',
    },
    items: items.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.quantity * item.unitPrice,
      tax_rate: taxRate,
      tax_amount: item.quantity * item.unitPrice * taxRate,
    })),
  };
}

export function resetOrderCounter() {
  orderCounter = 0;
}
