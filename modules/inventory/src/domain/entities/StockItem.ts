export class StockItem {
  private quantity: number;
  private reserved_quantity: number;
  private minimum_threshold: number;

  constructor(
    readonly product_id: string,
    readonly warehouse_id: string,
    quantity: number,
    reserved_quantity: number,
    minimum_threshold: number,
  ) {
    this.quantity = quantity;
    this.reserved_quantity = reserved_quantity;
    this.minimum_threshold = minimum_threshold;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getReservedQuantity(): number {
    return this.reserved_quantity;
  }

  getMinimumThreshold(): number {
    return this.minimum_threshold;
  }

  getAvailableQuantity(): number {
    return this.quantity - this.reserved_quantity;
  }

  isLowStock(): boolean {
    return this.getAvailableQuantity() <= this.minimum_threshold;
  }

  updateQuantity(quantity: number): void {
    if (quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }
    this.quantity = quantity;
  }

  updateReservedQuantity(reserved: number): void {
    if (reserved < 0) {
      throw new Error('Reserved quantity cannot be negative');
    }
    if (reserved > this.quantity) {
      throw new Error('Reserved quantity cannot exceed total quantity');
    }
    this.reserved_quantity = reserved;
  }

  reserve(quantity: number): void {
    const available = this.getAvailableQuantity();
    if (quantity > available) {
      throw new Error(
        `Insufficient stock to reserve: need ${quantity}, available ${available}`,
      );
    }
    this.reserved_quantity += quantity;
  }

  release(quantity: number): void {
    const toRelease = Math.min(quantity, this.reserved_quantity);
    this.reserved_quantity -= toRelease;
  }

  fulfill(quantity: number): void {
    if (quantity > this.reserved_quantity) {
      throw new Error(
        `Cannot fulfill ${quantity}: only ${this.reserved_quantity} reserved`,
      );
    }
    this.quantity -= quantity;
    this.reserved_quantity -= quantity;
  }
}
