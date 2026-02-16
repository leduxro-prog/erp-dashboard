import { describe, it, expect, beforeEach } from '@jest/globals';
import { SupplierOrderEntity, SupplierOrderStatus } from '../../src/domain/entities/SupplierOrder';

describe('SupplierOrderEntity', () => {
  let order: SupplierOrderEntity;

  beforeEach(() => {
    order = new SupplierOrderEntity({
      id: 1,
      supplierId: 1,
      orderId: null,
      items: [
        {
          supplierSku: 'SKU-001',
          internalSku: 'INT-001',
          productName: 'Product 1',
          quantity: 5,
          unitPrice: 10,
          totalPrice: 50,
        },
        {
          supplierSku: 'SKU-002',
          internalSku: 'INT-002',
          productName: 'Product 2',
          quantity: 3,
          unitPrice: 20,
          totalPrice: 60,
        },
      ],
      status: SupplierOrderStatus.PENDING,
      whatsappMessageTemplate: '',
      sentAt: null,
      confirmedAt: null,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('generateWhatsAppMessage', () => {
    it('should generate formatted message', () => {
      const message = order.generateWhatsAppMessage();

      expect(message).toContain('🛒 *NEW ORDER REQUEST*');
      expect(message).toContain('*Items:*');
      expect(message).toContain('Product 1');
      expect(message).toContain('Product 2');
      expect(message).toContain('SKU-001');
      expect(message).toContain('SKU-002');
    });

    it('should include quantities in message', () => {
      const message = order.generateWhatsAppMessage();

      expect(message).toContain('Qty: 5');
      expect(message).toContain('Qty: 3');
    });

    it('should include prices in message', () => {
      const message = order.generateWhatsAppMessage();

      expect(message).toContain('Unit Price: 10');
      expect(message).toContain('Total: 50');
      expect(message).toContain('Unit Price: 20');
      expect(message).toContain('Total: 60');
    });

    it('should include summary with total items', () => {
      const message = order.generateWhatsAppMessage();

      expect(message).toContain('*Summary:*');
      expect(message).toContain('Total Items: 8');
    });

    it('should include order total in summary', () => {
      const message = order.generateWhatsAppMessage();

      expect(message).toContain('Total Amount: 110');
    });

    it('should format single item order', () => {
      const singleItemOrder = new SupplierOrderEntity({
        ...order,
        items: [order.items[0]],
      });

      const message = singleItemOrder.generateWhatsAppMessage();

      expect(message).toContain('Product 1');
      expect(message).toContain('Total Items: 5');
      expect(message).toContain('Total Amount: 50');
    });

    it('should be valid WhatsApp format with line breaks', () => {
      const message = order.generateWhatsAppMessage();

      // Should contain newlines for proper formatting
      expect(message.split('\n').length).toBeGreaterThan(5);
    });
  });

  describe('getTotalQuantity', () => {
    it('should calculate total quantity', () => {
      expect(order.getTotalQuantity()).toBe(8);
    });

    it('should handle single item', () => {
      order.items = [order.items[0]];
      expect(order.getTotalQuantity()).toBe(5);
    });

    it('should return 0 for empty items', () => {
      order.items = [];
      expect(order.getTotalQuantity()).toBe(0);
    });
  });

  describe('getTotalAmount', () => {
    it('should calculate total amount', () => {
      expect(order.getTotalAmount()).toBe(110);
    });

    it('should handle single item', () => {
      order.items = [order.items[0]];
      expect(order.getTotalAmount()).toBe(50);
    });

    it('should return 0 for empty items', () => {
      order.items = [];
      expect(order.getTotalAmount()).toBe(0);
    });
  });

  describe('getItemCount', () => {
    it('should return number of line items', () => {
      expect(order.getItemCount()).toBe(2);
    });

    it('should return 0 for empty order', () => {
      order.items = [];
      expect(order.getItemCount()).toBe(0);
    });
  });

  describe('canBeSent', () => {
    it('should return true for pending order with items', () => {
      expect(order.canBeSent()).toBe(true);
    });

    it('should return false if already sent', () => {
      order.status = SupplierOrderStatus.SENT;
      expect(order.canBeSent()).toBe(false);
    });

    it('should return false if no items', () => {
      order.items = [];
      expect(order.canBeSent()).toBe(false);
    });

    it('should return false if already sent', () => {
      order.sentAt = new Date();
      expect(order.canBeSent()).toBe(false);
    });
  });

  describe('markAsSent', () => {
    it('should change status to sent', () => {
      order.markAsSent();

      expect(order.status).toBe(SupplierOrderStatus.SENT);
      expect(order.sentAt).not.toBeNull();
    });

    it('should throw error if not pending', () => {
      order.status = SupplierOrderStatus.CONFIRMED;

      expect(() => order.markAsSent()).toThrow();
    });

    it('should use provided timestamp', () => {
      const testDate = new Date('2024-06-01');
      order.markAsSent(testDate);

      expect(order.sentAt).toEqual(testDate);
    });
  });

  describe('markAsConfirmed', () => {
    it('should change status from sent to confirmed', () => {
      order.status = SupplierOrderStatus.SENT;
      order.markAsConfirmed();

      expect(order.status).toBe(SupplierOrderStatus.CONFIRMED);
      expect(order.confirmedAt).not.toBeNull();
    });

    it('should throw error if not sent', () => {
      expect(() => order.markAsConfirmed()).toThrow();
    });
  });

  describe('markAsDelivered', () => {
    it('should change status from confirmed to delivered', () => {
      order.status = SupplierOrderStatus.CONFIRMED;
      order.markAsDelivered();

      expect(order.status).toBe(SupplierOrderStatus.DELIVERED);
      expect(order.deliveredAt).not.toBeNull();
    });

    it('should throw error if not confirmed', () => {
      order.status = SupplierOrderStatus.SENT;
      expect(() => order.markAsDelivered()).toThrow();
    });
  });

  describe('cancel', () => {
    it('should cancel pending order', () => {
      order.cancel();

      expect(order.status).toBe(SupplierOrderStatus.CANCELLED);
    });

    it('should cancel sent order', () => {
      order.status = SupplierOrderStatus.SENT;
      order.cancel();

      expect(order.status).toBe(SupplierOrderStatus.CANCELLED);
    });

    it('should not cancel delivered order', () => {
      order.status = SupplierOrderStatus.DELIVERED;

      expect(() => order.cancel()).toThrow();
    });

    it('should not cancel already cancelled order', () => {
      order.status = SupplierOrderStatus.CANCELLED;

      expect(() => order.cancel()).toThrow();
    });
  });

  describe('getStatusLabel', () => {
    it('should return emoji label for pending', () => {
      order.status = SupplierOrderStatus.PENDING;
      expect(order.getStatusLabel()).toBe('⏳ Pending');
    });

    it('should return emoji label for sent', () => {
      order.status = SupplierOrderStatus.SENT;
      expect(order.getStatusLabel()).toBe('📤 Sent');
    });

    it('should return emoji label for confirmed', () => {
      order.status = SupplierOrderStatus.CONFIRMED;
      expect(order.getStatusLabel()).toBe('✅ Confirmed');
    });

    it('should return emoji label for delivered', () => {
      order.status = SupplierOrderStatus.DELIVERED;
      expect(order.getStatusLabel()).toBe('🚚 Delivered');
    });

    it('should return emoji label for cancelled', () => {
      order.status = SupplierOrderStatus.CANCELLED;
      expect(order.getStatusLabel()).toBe('❌ Cancelled');
    });
  });

  describe('order workflow', () => {
    it('should complete full order workflow', () => {
      // Start as pending
      expect(order.status).toBe(SupplierOrderStatus.PENDING);

      // Mark as sent
      order.markAsSent();
      expect(order.status).toBe(SupplierOrderStatus.SENT);

      // Mark as confirmed
      order.markAsConfirmed();
      expect(order.status).toBe(SupplierOrderStatus.CONFIRMED);

      // Mark as delivered
      order.markAsDelivered();
      expect(order.status).toBe(SupplierOrderStatus.DELIVERED);
    });

    it('should allow cancellation at any stage except delivered', () => {
      // Cancel from pending
      let testOrder = new SupplierOrderEntity(order);
      testOrder.cancel();
      expect(testOrder.status).toBe(SupplierOrderStatus.CANCELLED);

      // Cancel from sent
      testOrder = new SupplierOrderEntity(order);
      testOrder.status = SupplierOrderStatus.SENT;
      testOrder.cancel();
      expect(testOrder.status).toBe(SupplierOrderStatus.CANCELLED);
    });
  });
});
