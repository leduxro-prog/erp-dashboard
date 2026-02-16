export class InsufficientStockError extends Error {
  constructor(
    public readonly productId: number,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `Insufficient stock for product ${productId}. ` +
      `Requested: ${requested}, Available: ${available}`
    );
    this.name = 'InsufficientStockError';
  }
}

export class WarehouseNotFoundError extends Error {
  constructor(public readonly warehouseId: string) {
    super(`Warehouse not found: ${warehouseId}`);
    this.name = 'WarehouseNotFoundError';
  }
}

export class ReservationNotFoundError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = 'ReservationNotFoundError';
  }
}

export class StockSyncError extends Error {
  constructor(
    public readonly syncSource: string,
    public readonly details: string,
    public readonly originalError?: Error
  ) {
    super(`Stock sync failed for ${syncSource}: ${details}`);
    this.name = 'StockSyncError';
  }
}

export class InvalidStockOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStockOperationError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(public readonly productId: string) {
    super(`Product not found: ${productId}`);
    this.name = 'ProductNotFoundError';
  }
}

export class ReservationExpiredError extends Error {
  constructor(public readonly reservationId: string) {
    super(`Reservation has expired: ${reservationId}`);
    this.name = 'ReservationExpiredError';
  }
}
