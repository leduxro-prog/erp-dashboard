/**
 * Order Item Entity
 * Represents a line item in an order with delivery tracking and cost snapshot
 */
export type CostSource =
  | 'metadata'
  | 'pricing_engine'
  | 'smartbill_invoice'
  | 'excel_import'
  | 'manual'
  | 'estimated'
  | 'backfill_metadata'
  | 'backfill_estimated';

export class OrderItem {
  readonly id: string;
  readonly productId: number;
  readonly sku: string;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly sourceWarehouseId?: number;
  /** Immutable cost price captured at the moment of sale */
  readonly costPriceSnapshot: number | null;
  /** Origin of the cost data (metadata, pricing_engine, estimated, etc.) */
  readonly costSource: CostSource | null;

  quantityDelivered: number;
  quantityRemaining: number;

  constructor(props: {
    id: string;
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    sourceWarehouseId?: number;
    quantityDelivered?: number;
    costPriceSnapshot?: number | null;
    costSource?: CostSource | null;
  }) {
    this.id = props.id;
    this.productId = props.productId;
    this.sku = props.sku;
    this.productName = props.productName;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.sourceWarehouseId = props.sourceWarehouseId;
    this.costPriceSnapshot = props.costPriceSnapshot ?? null;
    this.costSource = props.costSource ?? null;
    this.quantityDelivered = props.quantityDelivered || 0;
    this.quantityRemaining = this.quantity - this.quantityDelivered;

    this.validate();
  }

  private validate(): void {
    if (this.quantity <= 0) {
      throw new Error('Order item quantity must be greater than 0');
    }
    if (this.unitPrice < 0) {
      throw new Error('Order item unit price cannot be negative');
    }
    if (this.quantityDelivered < 0 || this.quantityDelivered > this.quantity) {
      throw new Error('Quantity delivered must be between 0 and total quantity');
    }
  }

  getLineTotal(): number {
    return this.quantity * this.unitPrice;
  }

  /** Gross profit for this line item (null if cost is unknown) */
  getGrossProfit(): number | null {
    if (this.costPriceSnapshot === null) return null;
    return this.getLineTotal() - this.quantity * this.costPriceSnapshot;
  }

  /** Gross margin percentage (null if cost is unknown) */
  getGrossMarginPercent(): number | null {
    if (this.costPriceSnapshot === null || this.unitPrice === 0) return null;
    return ((this.unitPrice - this.costPriceSnapshot) / this.unitPrice) * 100;
  }

  recordDelivery(quantity: number): void {
    const newTotal = this.quantityDelivered + quantity;
    if (newTotal > this.quantity) {
      throw new Error(
        `Cannot deliver ${quantity} units. Only ${this.quantityRemaining} remaining.`,
      );
    }
    this.quantityDelivered = newTotal;
    this.quantityRemaining = this.quantity - this.quantityDelivered;
  }

  isFullyDelivered(): boolean {
    return this.quantityDelivered === this.quantity;
  }

  isPartiallyDelivered(): boolean {
    return this.quantityDelivered > 0 && this.quantityDelivered < this.quantity;
  }

  static create(props: {
    id: string;
    productId: number;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    sourceWarehouseId?: number;
    quantityDelivered?: number;
    costPriceSnapshot?: number | null;
    costSource?: CostSource | null;
  }): OrderItem {
    return new OrderItem(props);
  }

  toJSON() {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      productName: this.productName,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      quantityDelivered: this.quantityDelivered,
      quantityRemaining: this.quantityRemaining,
      lineTotal: this.getLineTotal(),
      sourceWarehouseId: this.sourceWarehouseId,
      costPriceSnapshot: this.costPriceSnapshot,
      costSource: this.costSource,
      grossProfit: this.getGrossProfit(),
      grossMarginPercent: this.getGrossMarginPercent(),
    };
  }
}
