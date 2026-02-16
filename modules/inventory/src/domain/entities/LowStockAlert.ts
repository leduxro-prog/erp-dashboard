export type AlertSeverity = 'warning' | 'critical';

export interface LowStockAlertProps {
  id: string;
  productId: number;
  productSku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  currentQuantity: number;
  minimumThreshold: number;
  severity: AlertSeverity;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export class LowStockAlert {
  private readonly id: string;
  private readonly productId: number;
  private readonly productSku: string;
  private readonly productName: string;
  private readonly warehouseId: string;
  private readonly warehouseName: string;
  private readonly currentQuantity: number;
  private readonly minimumThreshold: number;
  private readonly severity: AlertSeverity;
  private acknowledged: boolean;
  private acknowledgedBy?: string;
  private acknowledgedAt?: Date;
  private readonly createdAt: Date;

  constructor(props: LowStockAlertProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Alert id is required');
    }

    if (props.productId <= 0) {
      throw new Error('Product id must be positive');
    }

    if (!props.productSku || props.productSku.trim().length === 0) {
      throw new Error('Product SKU is required');
    }

    if (!props.productName || props.productName.trim().length === 0) {
      throw new Error('Product name is required');
    }

    if (!props.warehouseId || props.warehouseId.trim().length === 0) {
      throw new Error('Warehouse id is required');
    }

    if (!props.warehouseName || props.warehouseName.trim().length === 0) {
      throw new Error('Warehouse name is required');
    }

    if (props.minimumThreshold < 0) {
      throw new Error('Minimum threshold cannot be negative');
    }

    if (props.currentQuantity < 0) {
      throw new Error('Current quantity cannot be negative');
    }

    this.id = props.id;
    this.productId = props.productId;
    this.productSku = props.productSku;
    this.productName = props.productName;
    this.warehouseId = props.warehouseId;
    this.warehouseName = props.warehouseName;
    this.currentQuantity = props.currentQuantity;
    this.minimumThreshold = props.minimumThreshold;
    this.severity = props.severity;
    this.acknowledged = props.acknowledged;
    this.acknowledgedBy = props.acknowledgedBy;
    this.acknowledgedAt = props.acknowledgedAt;
    this.createdAt = props.createdAt;
  }

  getId(): string {
    return this.id;
  }

  getProductId(): number {
    return this.productId;
  }

  getProductSku(): string {
    return this.productSku;
  }

  getProductName(): string {
    return this.productName;
  }

  getWarehouseId(): string {
    return this.warehouseId;
  }

  getWarehouseName(): string {
    return this.warehouseName;
  }

  getCurrentQuantity(): number {
    return this.currentQuantity;
  }

  getMinimumThreshold(): number {
    return this.minimumThreshold;
  }

  getSeverity(): AlertSeverity {
    return this.severity;
  }

  isAcknowledged(): boolean {
    return this.acknowledged;
  }

  getAcknowledgedBy(): string | undefined {
    return this.acknowledgedBy;
  }

  getAcknowledgedAt(): Date | undefined {
    return this.acknowledgedAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  acknowledge(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      throw new Error('User id is required for acknowledgment');
    }

    this.acknowledged = true;
    this.acknowledgedBy = userId;
    this.acknowledgedAt = new Date();
  }

  static determineSeverity(currentQuantity: number): AlertSeverity {
    return currentQuantity <= 0 ? 'critical' : 'warning';
  }

  static create(params: {
    id: string;
    productId: number;
    productSku: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    currentQuantity: number;
    minimumThreshold: number;
    createdAt?: Date;
  }): LowStockAlert {
    const severity = this.determineSeverity(params.currentQuantity);

    return new LowStockAlert({
      ...params,
      severity,
      acknowledged: false,
      createdAt: params.createdAt ?? new Date(),
    });
  }
}
