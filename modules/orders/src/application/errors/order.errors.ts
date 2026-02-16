/**
 * Order Application Errors
 * Custom error types for order use cases
 */

export class OrderNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Order not found: ${identifier}`);
    this.name = 'OrderNotFoundError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(fromStatus: string, toStatus: string, validStatuses: string[]) {
    const validList = validStatuses.join(', ');
    super(
      `Cannot transition from ${fromStatus} to ${toStatus}. Valid statuses: ${validList}`
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

export class InsufficientStockError extends Error {
  constructor(productId: number, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`
    );
    this.name = 'InsufficientStockError';
  }
}

export class OrderCancellationError extends Error {
  constructor(orderId: number, reason: string) {
    super(`Cannot cancel order ${orderId}: ${reason}`);
    this.name = 'OrderCancellationError';
  }
}

export class InvalidDeliveryQuantityError extends Error {
  constructor(itemId: string, quantity: number, remaining: number) {
    super(
      `Invalid delivery quantity for item ${itemId}. Requested: ${quantity}, Remaining: ${remaining}`
    );
    this.name = 'InvalidDeliveryQuantityError';
  }
}

export class OrderAlreadyExistsError extends Error {
  constructor(orderNumber: string) {
    super(`Order with number ${orderNumber} already exists`);
    this.name = 'OrderAlreadyExistsError';
  }
}

export class InvalidOrderInputError extends Error {
  constructor(message: string) {
    super(`Invalid order input: ${message}`);
    this.name = 'InvalidOrderInputError';
  }
}

export class ProformaGenerationError extends Error {
  constructor(orderId: number, reason: string) {
    super(`Failed to generate proforma for order ${orderId}: ${reason}`);
    this.name = 'ProformaGenerationError';
  }
}

export class InvoiceGenerationError extends Error {
  constructor(orderId: number, reason: string) {
    super(`Failed to generate invoice for order ${orderId}: ${reason}`);
    this.name = 'InvoiceGenerationError';
  }
}

export class StockReservationError extends Error {
  constructor(message: string) {
    super(`Stock reservation failed: ${message}`);
    this.name = 'StockReservationError';
  }
}
