/**
 * Status Change Value Object
 * Tracks historical status transitions with metadata
 */
import { OrderStatus } from './OrderStatus';

export class StatusChange {
  readonly fromStatus: OrderStatus;
  readonly toStatus: OrderStatus;
  readonly changedBy: string;
  readonly changedAt: Date;
  readonly notes?: string;

  constructor(props: {
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    changedBy: string;
    changedAt?: Date;
    notes?: string;
  }) {
    this.fromStatus = props.fromStatus;
    this.toStatus = props.toStatus;
    this.changedBy = props.changedBy;
    this.changedAt = props.changedAt || new Date();
    this.notes = props.notes;

    this.validate();
  }

  private validate(): void {
    if (!this.fromStatus || !this.toStatus) {
      throw new Error('Status change requires both fromStatus and toStatus');
    }
    if (!this.changedBy || this.changedBy.trim().length === 0) {
      throw new Error('Status change requires changedBy user identifier');
    }
  }

  static create(props: {
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    changedBy: string;
    changedAt?: Date;
    notes?: string;
  }): StatusChange {
    return new StatusChange(props);
  }

  toJSON() {
    return {
      fromStatus: this.fromStatus,
      toStatus: this.toStatus,
      changedBy: this.changedBy,
      changedAt: this.changedAt.toISOString(),
      notes: this.notes,
    };
  }
}
