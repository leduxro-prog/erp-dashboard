/**
 * Maximum backorder window in days
 * Orders reserved beyond this window will expire automatically
 */
export const MAX_BACKORDER_DAYS = 10;

export type ReservationStatus = 'active' | 'fulfilled' | 'released' | 'expired';

export interface ReservationItem {
  productId: number;
  warehouseId: string;
  quantity: number;
}

export interface StockReservationProps {
  id: string;
  orderId: string;
  items: ReservationItem[];
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
}

export class StockReservation {
  private readonly id: string;
  private readonly orderId: string;
  private readonly items: ReservationItem[];
  private status: ReservationStatus;
  private readonly expiresAt: Date;
  private readonly createdAt: Date;

  constructor(props: StockReservationProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Reservation id is required');
    }

    if (!props.orderId || props.orderId.trim().length === 0) {
      throw new Error('Order id is required');
    }

    if (!props.items || props.items.length === 0) {
      throw new Error('At least one reservation item is required');
    }

    this.validateItems(props.items);

    const validStatuses: ReservationStatus[] = [
      'active',
      'fulfilled',
      'released',
      'expired',
    ];
    if (!validStatuses.includes(props.status)) {
      throw new Error(
        `Invalid status: ${props.status}. Must be one of: ${validStatuses.join(', ')}`
      );
    }

    this.id = props.id;
    this.orderId = props.orderId;
    this.items = props.items;
    this.status = props.status;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
  }

  private validateItems(items: ReservationItem[]): void {
    for (const item of items) {
      if (item.productId <= 0) {
        throw new Error('Product id must be positive');
      }

      if (!item.warehouseId || item.warehouseId.trim().length === 0) {
        throw new Error('Warehouse id is required for reservation item');
      }

      if (item.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
    }
  }

  getId(): string {
    return this.id;
  }

  getOrderId(): string {
    return this.orderId;
  }

  getItems(): ReservationItem[] {
    return [...this.items];
  }

  getStatus(): ReservationStatus {
    return this.status;
  }

  getExpiresAt(): Date {
    return this.expiresAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isActive(): boolean {
    return this.status === 'active' && !this.isExpired();
  }

  fulfill(): void {
    if (this.status !== 'active') {
      throw new Error(
        `Cannot fulfill reservation with status: ${this.status}`
      );
    }

    if (this.isExpired()) {
      throw new Error('Cannot fulfill expired reservation');
    }

    this.status = 'fulfilled';
  }

  release(): void {
    if (this.status !== 'active') {
      throw new Error(
        `Cannot release reservation with status: ${this.status}`
      );
    }

    this.status = 'released';
  }

  expire(): void {
    if (this.status === 'active') {
      this.status = 'expired';
    }
  }

  static create(params: {
    id: string;
    orderId: string;
    items: ReservationItem[];
    expiresAt: Date;
    createdAt?: Date;
  }): StockReservation {
    return new StockReservation({
      ...params,
      status: 'active',
      createdAt: params.createdAt ?? new Date(),
    });
  }

  static createWithBackorderWindow(params: {
    id: string;
    orderId: string;
    items: ReservationItem[];
    backorderDaysMax?: number;
    createdAt?: Date;
  }): StockReservation {
    const backorderDays = params.backorderDaysMax ?? MAX_BACKORDER_DAYS;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + backorderDays);

    return StockReservation.create({
      id: params.id,
      orderId: params.orderId,
      items: params.items,
      expiresAt,
      createdAt: params.createdAt,
    });
  }
}
