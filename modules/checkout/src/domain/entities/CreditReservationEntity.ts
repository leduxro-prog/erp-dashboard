/**
 * Credit Reservation Entity
 *
 * Represents a temporary reservation of credit for an order.
 * This ensures that credit is available for the order during
 * the checkout process.
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

const decimalNumberTransformer = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
};

export enum CreditReservationStatus {
  ACTIVE = 'ACTIVE',
  CAPTURED = 'CAPTURED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

@Entity('credit_reservations')
@Index(['customerId'])
@Index(['orderId'])
@Index(['status'])
@Index(['expiresAt'])
export class CreditReservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column('uuid')
  orderId!: string;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalNumberTransformer })
  amount!: number;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalNumberTransformer })
  balanceBefore!: number;

  @Column('decimal', { precision: 12, scale: 2, transformer: decimalNumberTransformer })
  balanceAfter!: number;

  @Column({
    type: 'enum',
    enum: CreditReservationStatus,
    default: CreditReservationStatus.ACTIVE,
  })
  status!: CreditReservationStatus;

  @Column('timestamp with time zone')
  reservedAt!: Date;

  @Column('timestamp with time zone')
  expiresAt!: Date;

  @Column('timestamp with time zone', { nullable: true })
  capturedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  releasedAt?: Date;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @Column('uuid', { nullable: true })
  createdBy?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
