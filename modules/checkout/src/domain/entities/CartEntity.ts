/**
 * Cart Entity
 *
 * Represents a shopping cart in the checkout process.
 */

import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  PROCESSING = 'PROCESSING',
  CONVERTED = 'CONVERTED',
  ABANDONED = 'ABANDONED',
}

export interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  warehouseId?: string;
}

@Entity('checkout_carts')
@Index(['customerId'])
@Index(['status'])
@Index(['expiresAt'])
export class CartEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  customerId!: string | null;

  @Column('uuid', { nullable: true })
  sessionId!: string | null;

  @Column({
    type: 'enum',
    enum: CartStatus,
    default: CartStatus.ACTIVE,
  })
  status!: CartStatus;

  @Column('jsonb')
  items!: CartItem[];

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discountRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  discountAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  taxAmount!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  shippingCost!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total!: number;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('uuid', { nullable: true })
  orderId?: string;

  @Column('timestamp with time zone', { nullable: true })
  expiresAt?: Date;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
