import { beforeEach, describe, expect, it } from '@jest/globals';
import { Address } from '../../src/domain/entities/Address';
import { Order } from '../../src/domain/entities/Order';
import { OrderItem } from '../../src/domain/entities/OrderItem';
import { OrderStatus } from '../../src/domain/entities/OrderStatus';

describe('Order Domain Model', () => {
  let order: Order;

  beforeEach(() => {
    const billingAddress = new Address({
      name: 'John Doe',
      street: '123 Main St',
      city: 'Bucharest',
      county: 'Bucuresti',
      postalCode: '010001',
      country: 'Romania',
    });

    const shippingAddress = new Address({
      name: 'John Doe',
      street: '456 Oak Ave',
      city: 'Cluj',
      county: 'Cluj',
      postalCode: '400000',
      country: 'Romania',
    });

    const item1 = new OrderItem({
      id: 'item1',
      productId: 1,
      sku: 'SKU001',
      productName: 'Product A',
      unitPrice: 100,
      quantity: 5,
    });

    const item2 = new OrderItem({
      id: 'item2',
      productId: 2,
      sku: 'SKU002',
      productName: 'Product B',
      unitPrice: 50,
      quantity: 3,
    });

    order = new Order({
      id: 1,
      orderNumber: 'ORD-20250207-0001',
      customerId: 123,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      status: OrderStatus.QUOTE_PENDING,
      items: [item1, item2],
      billingAddress,
      shippingAddress,
      subtotal: 650,
      discountAmount: 50,
      taxAmount: 0,
      shippingCost: 25,
      grandTotal: 0,
      paymentTerms: 'net_30',
      createdBy: 'admin',
      updatedBy: 'admin',
    });
  });

  it('creates with expected defaults', () => {
    expect(order.orderNumber).toBe('ORD-20250207-0001');
    expect(order.items).toHaveLength(2);
    expect(order.paymentStatus).toBe('pending');
  });

  it('calculates totals with VAT and discount', () => {
    order.calculateTotals();
    expect(order.taxRate).toBe(0.21);
    expect(order.taxAmount).toBeCloseTo(126, 1);
    expect(order.grandTotal).toBeCloseTo(751, 1);
  });

  it('supports valid lifecycle transitions', () => {
    order.updateStatus(OrderStatus.QUOTE_SENT, 'admin');
    order.updateStatus(OrderStatus.QUOTE_ACCEPTED, 'admin');
    order.updateStatus(OrderStatus.ORDER_CONFIRMED, 'admin');
    expect(order.status).toBe(OrderStatus.ORDER_CONFIRMED);
  });

  it('requires note when cancelling from order_confirmed', () => {
    order.updateStatus(OrderStatus.QUOTE_SENT, 'admin');
    order.updateStatus(OrderStatus.QUOTE_ACCEPTED, 'admin');
    order.updateStatus(OrderStatus.ORDER_CONFIRMED, 'admin');

    expect(() => order.updateStatus(OrderStatus.CANCELLED, 'admin')).toThrow('requires a note');
  });

  it('records partial deliveries and full delivery state', () => {
    order.updateStatus(OrderStatus.QUOTE_SENT, 'admin');
    order.updateStatus(OrderStatus.QUOTE_ACCEPTED, 'admin');
    order.updateStatus(OrderStatus.ORDER_CONFIRMED, 'admin');
    order.updateStatus(OrderStatus.IN_PREPARATION, 'admin');
    order.updateStatus(OrderStatus.READY_TO_SHIP, 'admin');
    order.updateStatus(OrderStatus.SHIPPED, 'admin');

    order.recordPartialDelivery([{ itemId: 'item1', quantityDelivered: 3 }]);
    expect(order.items[0].quantityDelivered).toBe(3);
    expect(order.isFullyDelivered()).toBe(false);

    order.recordPartialDelivery([
      { itemId: 'item1', quantityDelivered: 2 },
      { itemId: 'item2', quantityDelivered: 3 },
    ]);
    expect(order.isFullyDelivered()).toBe(true);
  });

  it('adds/removes items and serializes to JSON', () => {
    order.addItem(
      new OrderItem({
        id: 'item3',
        productId: 3,
        sku: 'SKU003',
        productName: 'Product C',
        unitPrice: 75,
        quantity: 2,
      }),
    );
    expect(order.items).toHaveLength(3);

    order.removeItem('item1');
    expect(order.items).toHaveLength(2);

    const json = order.toJSON();
    expect(json.orderNumber).toBe('ORD-20250207-0001');
    expect(json.customerId).toBe(123);
  });
});
