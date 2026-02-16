import { describe, it, expect, beforeEach } from '@jest/globals';
import { OrderStatus } from '../../src/domain/entities/OrderStatus';
import { OrderStatusMachine } from '../../src/domain/entities/OrderStatusMachine';

describe('OrderStatusMachine', () => {
  describe('valid transitions', () => {
    it('should allow QUOTE_PENDING -> QUOTE_SENT', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.QUOTE_PENDING, OrderStatus.QUOTE_SENT),
      ).toBe(true);
    });

    it('should allow QUOTE_PENDING -> CANCELLED', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.QUOTE_PENDING, OrderStatus.CANCELLED),
      ).toBe(true);
    });

    it('should allow QUOTE_SENT -> QUOTE_ACCEPTED', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.QUOTE_SENT, OrderStatus.QUOTE_ACCEPTED),
      ).toBe(true);
    });

    it('should allow QUOTE_ACCEPTED -> ORDER_CONFIRMED', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.QUOTE_ACCEPTED, OrderStatus.ORDER_CONFIRMED),
      ).toBe(true);
    });

    it('should allow ORDER_CONFIRMED -> SUPPLIER_ORDER_PLACED', () => {
      expect(
        OrderStatusMachine.canTransition(
          OrderStatus.ORDER_CONFIRMED,
          OrderStatus.SUPPLIER_ORDER_PLACED,
        ),
      ).toBe(true);
    });

    it('should allow ORDER_CONFIRMED -> IN_PREPARATION', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.ORDER_CONFIRMED, OrderStatus.IN_PREPARATION),
      ).toBe(true);
    });

    it('should allow SUPPLIER_ORDER_PLACED -> AWAITING_DELIVERY', () => {
      expect(
        OrderStatusMachine.canTransition(
          OrderStatus.SUPPLIER_ORDER_PLACED,
          OrderStatus.AWAITING_DELIVERY,
        ),
      ).toBe(true);
    });

    it('should allow AWAITING_DELIVERY -> IN_PREPARATION', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.AWAITING_DELIVERY, OrderStatus.IN_PREPARATION),
      ).toBe(true);
    });

    it('should allow IN_PREPARATION -> READY_TO_SHIP', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.IN_PREPARATION, OrderStatus.READY_TO_SHIP),
      ).toBe(true);
    });

    it('should allow READY_TO_SHIP -> SHIPPED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.READY_TO_SHIP, OrderStatus.SHIPPED)).toBe(
        true,
      );
    });

    it('should allow SHIPPED -> DELIVERED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(
        true,
      );
    });

    it('should allow DELIVERED -> INVOICED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.DELIVERED, OrderStatus.INVOICED)).toBe(
        true,
      );
    });

    it('should allow INVOICED -> PAID', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.INVOICED, OrderStatus.PAID)).toBe(true);
    });

    it('should allow PAID -> RETURNED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.PAID, OrderStatus.RETURNED)).toBe(true);
    });

    it('should allow DELIVERED -> RETURNED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(
        true,
      );
    });
  });

  describe('invalid transitions', () => {
    it('should reject PAID -> SHIPPED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(false);
    });

    it('should reject CANCELLED -> QUOTE_PENDING', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.QUOTE_PENDING),
      ).toBe(false);
    });

    it('should reject QUOTE_PENDING -> SHIPPED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.QUOTE_PENDING, OrderStatus.SHIPPED)).toBe(
        false,
      );
    });

    it('should reject QUOTE_SENT -> DELIVERED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.QUOTE_SENT, OrderStatus.DELIVERED)).toBe(
        false,
      );
    });

    it('should reject DELIVERED -> IN_PREPARATION', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.DELIVERED, OrderStatus.IN_PREPARATION),
      ).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('should not identify PAID as terminal state (can transition to RETURNED)', () => {
      expect(OrderStatusMachine.isTerminal(OrderStatus.PAID)).toBe(false);
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.PAID)).toEqual([OrderStatus.RETURNED]);
    });

    it('should identify CANCELLED as terminal state', () => {
      expect(OrderStatusMachine.isTerminal(OrderStatus.CANCELLED)).toBe(true);
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
    });

    it('should identify RETURNED as terminal state', () => {
      expect(OrderStatusMachine.isTerminal(OrderStatus.RETURNED)).toBe(true);
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.RETURNED)).toEqual([]);
    });

    it('should not be terminal for QUOTE_PENDING', () => {
      expect(OrderStatusMachine.isTerminal(OrderStatus.QUOTE_PENDING)).toBe(false);
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.QUOTE_PENDING).length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('cancellation', () => {
    it('should allow cancellation from QUOTE_PENDING', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.QUOTE_PENDING, OrderStatus.CANCELLED),
      ).toBe(true);
    });

    it('should allow cancellation from QUOTE_SENT', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.QUOTE_SENT, OrderStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('should allow cancellation from ORDER_CONFIRMED', () => {
      expect(
        OrderStatusMachine.canTransition(OrderStatus.ORDER_CONFIRMED, OrderStatus.CANCELLED),
      ).toBe(true);
    });

    it('should not allow cancellation from PAID', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
    });

    it('should not allow cancellation from CANCELLED', () => {
      expect(OrderStatusMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(
        false,
      );
    });
  });

  describe('getNextStatuses', () => {
    it('should return correct options for QUOTE_PENDING', () => {
      const next = OrderStatusMachine.getNextStatuses(OrderStatus.QUOTE_PENDING);
      expect(next).toContain(OrderStatus.QUOTE_SENT);
      expect(next).toContain(OrderStatus.CANCELLED);
    });

    it('should return correct options for SHIPPED', () => {
      const next = OrderStatusMachine.getNextStatuses(OrderStatus.SHIPPED);
      expect(next).toContain(OrderStatus.DELIVERED);
    });

    it('should return empty array for terminal states', () => {
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
      expect(OrderStatusMachine.getNextStatuses(OrderStatus.RETURNED)).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('should validate successful transition', () => {
      const result = OrderStatusMachine.validateTransition(
        OrderStatus.QUOTE_PENDING,
        OrderStatus.QUOTE_SENT,
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid transition with error message', () => {
      const result = OrderStatusMachine.validateTransition(OrderStatus.PAID, OrderStatus.SHIPPED);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject transition from terminal status', () => {
      const result = OrderStatusMachine.validateTransition(
        OrderStatus.CANCELLED,
        OrderStatus.QUOTE_SENT,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal status');
    });
  });

  describe('requiresNote', () => {
    it('should require note for cancellation transitions', () => {
      expect(
        OrderStatusMachine.requiresNote(OrderStatus.ORDER_CONFIRMED, OrderStatus.CANCELLED),
      ).toBe(true);
    });

    it('should not require note for normal transitions', () => {
      expect(
        OrderStatusMachine.requiresNote(OrderStatus.QUOTE_PENDING, OrderStatus.QUOTE_SENT),
      ).toBe(false);
    });
  });
});
