export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RESERVE' | 'RELEASE';
export type ReferenceType = 'order' | 'sync' | 'manual' | 'transfer';

export interface StockMovementProps {
  id: string;
  productId: number;
  warehouseId: string;
  movementType: MovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  referenceType: ReferenceType;
  referenceId: string;
  createdBy: string;
  createdAt: Date;
}

export class StockMovement {
  private readonly id: string;
  private readonly productId: number;
  private readonly warehouseId: string;
  private readonly movementType: MovementType;
  private readonly quantity: number;
  private readonly previousQuantity: number;
  private readonly newQuantity: number;
  private readonly reason: string;
  private readonly referenceType: ReferenceType;
  private readonly referenceId: string;
  private readonly createdBy: string;
  private readonly createdAt: Date;

  constructor(props: StockMovementProps) {
    this.validateProps(props);

    this.id = props.id;
    this.productId = props.productId;
    this.warehouseId = props.warehouseId;
    this.movementType = props.movementType;
    this.quantity = props.quantity;
    this.previousQuantity = props.previousQuantity;
    this.newQuantity = props.newQuantity;
    this.reason = props.reason;
    this.referenceType = props.referenceType;
    this.referenceId = props.referenceId;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
  }

  private validateProps(props: StockMovementProps): void {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('StockMovement id is required');
    }

    if (props.productId <= 0) {
      throw new Error('Product id must be positive');
    }

    if (!props.warehouseId || props.warehouseId.trim().length === 0) {
      throw new Error('Warehouse id is required');
    }

    if (!props.reason || props.reason.trim().length === 0) {
      throw new Error('Reason is required');
    }

    if (!props.referenceId || props.referenceId.trim().length === 0) {
      throw new Error('Reference id is required');
    }

    if (!props.createdBy || props.createdBy.trim().length === 0) {
      throw new Error('Created by is required');
    }

    const validMovementTypes: MovementType[] = [
      'IN',
      'OUT',
      'ADJUSTMENT',
      'TRANSFER',
      'RESERVE',
      'RELEASE',
    ];
    if (!validMovementTypes.includes(props.movementType)) {
      throw new Error(
        `Invalid movement type: ${props.movementType}. Must be one of: ${validMovementTypes.join(', ')}`
      );
    }

    const validReferenceTypes: ReferenceType[] = ['order', 'sync', 'manual', 'transfer'];
    if (!validReferenceTypes.includes(props.referenceType)) {
      throw new Error(
        `Invalid reference type: ${props.referenceType}. Must be one of: ${validReferenceTypes.join(', ')}`
      );
    }
  }

  getId(): string {
    return this.id;
  }

  getProductId(): number {
    return this.productId;
  }

  getWarehouseId(): string {
    return this.warehouseId;
  }

  getMovementType(): MovementType {
    return this.movementType;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getPreviousQuantity(): number {
    return this.previousQuantity;
  }

  getNewQuantity(): number {
    return this.newQuantity;
  }

  getReason(): string {
    return this.reason;
  }

  getReferenceType(): ReferenceType {
    return this.referenceType;
  }

  getReferenceId(): string {
    return this.referenceId;
  }

  getCreatedBy(): string {
    return this.createdBy;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  static create(params: {
    id: string;
    productId: number;
    warehouseId: string;
    movementType: MovementType;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    reason: string;
    referenceType: ReferenceType;
    referenceId: string;
    createdBy: string;
    createdAt?: Date;
  }): StockMovement {
    return new StockMovement({
      ...params,
      createdAt: params.createdAt ?? new Date(),
    });
  }
}
