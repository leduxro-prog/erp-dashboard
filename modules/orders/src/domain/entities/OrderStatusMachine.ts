/**
 * Order Status Machine
 * Manages valid state transitions for orders with business rules
 */
import { OrderStatus } from './OrderStatus';

export class OrderStatusMachine {
  /**
   * Defines valid transitions between order statuses
   * Each status maps to an array of valid next statuses
   */
  private static readonly VALID_TRANSITIONS: Map<OrderStatus, OrderStatus[]> = new Map([
    [OrderStatus.QUOTE_PENDING, [OrderStatus.QUOTE_SENT, OrderStatus.CANCELLED]],
    [OrderStatus.QUOTE_SENT, [OrderStatus.QUOTE_ACCEPTED, OrderStatus.CANCELLED]],
    [OrderStatus.QUOTE_ACCEPTED, [OrderStatus.ORDER_CONFIRMED, OrderStatus.CANCELLED]],
    [
      OrderStatus.ORDER_CONFIRMED,
      [OrderStatus.SUPPLIER_ORDER_PLACED, OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED],
    ],
    [OrderStatus.SUPPLIER_ORDER_PLACED, [OrderStatus.AWAITING_DELIVERY, OrderStatus.CANCELLED]],
    [OrderStatus.AWAITING_DELIVERY, [OrderStatus.IN_PREPARATION, OrderStatus.CANCELLED]],
    [OrderStatus.IN_PREPARATION, [OrderStatus.READY_TO_SHIP, OrderStatus.CANCELLED]],
    [OrderStatus.READY_TO_SHIP, [OrderStatus.SHIPPED, OrderStatus.CANCELLED]],
    [OrderStatus.SHIPPED, [OrderStatus.DELIVERED]],
    [OrderStatus.DELIVERED, [OrderStatus.INVOICED, OrderStatus.RETURNED]],
    [OrderStatus.INVOICED, [OrderStatus.PAID]],
    [OrderStatus.PAID, [OrderStatus.RETURNED]],
    [OrderStatus.CANCELLED, []],
    [OrderStatus.RETURNED, []],
  ]);

  /**
   * Terminal statuses - no further transitions allowed
   */
  private static readonly TERMINAL_STATUSES: Set<OrderStatus> = new Set([
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
  ]);

  /**
   * Statuses that require a note when transitioning
   */
  private static readonly REQUIRE_NOTE_TRANSITIONS: Map<OrderStatus, OrderStatus[]> = new Map([
    [OrderStatus.CANCELLED, Object.values(OrderStatus)],
    [OrderStatus.QUOTE_ACCEPTED, [OrderStatus.CANCELLED]],
    [OrderStatus.ORDER_CONFIRMED, [OrderStatus.CANCELLED]],
    [OrderStatus.SUPPLIER_ORDER_PLACED, [OrderStatus.CANCELLED]],
    [OrderStatus.IN_PREPARATION, [OrderStatus.CANCELLED]],
    [OrderStatus.READY_TO_SHIP, [OrderStatus.CANCELLED]],
  ]);

  /**
   * Check if transition is valid between two statuses
   */
  static canTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
    const validNextStatuses = this.VALID_TRANSITIONS.get(fromStatus);
    if (!validNextStatuses) {
      return false;
    }
    return validNextStatuses.includes(toStatus);
  }

  /**
   * Get all valid next statuses for a given status
   */
  static getNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
    return this.VALID_TRANSITIONS.get(currentStatus) || [];
  }

  /**
   * Check if a status is terminal (no further transitions allowed)
   */
  static isTerminal(status: OrderStatus): boolean {
    return this.TERMINAL_STATUSES.has(status);
  }

  /**
   * Check if a transition requires a note to be provided
   */
  static requiresNote(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
    const requiresNoteTransitions = this.REQUIRE_NOTE_TRANSITIONS.get(fromStatus);
    if (!requiresNoteTransitions) {
      return false;
    }
    return requiresNoteTransitions.includes(toStatus);
  }

  /**
   * Validate transition and return detailed error if invalid
   */
  static validateTransition(
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
  ): { valid: boolean; error?: string } {
    if (this.isTerminal(fromStatus)) {
      return {
        valid: false,
        error: `Cannot transition from terminal status ${fromStatus}`,
      };
    }

    if (!this.canTransition(fromStatus, toStatus)) {
      const validStatuses = this.getNextStatuses(fromStatus);
      return {
        valid: false,
        error: `Invalid transition from ${fromStatus} to ${toStatus}. Valid transitions: ${validStatuses.join(', ')}`,
      };
    }

    return { valid: true };
  }
}
