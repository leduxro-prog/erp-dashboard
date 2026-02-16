import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OrderItemEntity } from './OrderItemEntity';
import { OrderStatusHistoryEntity } from './OrderStatusHistoryEntity';

// Re-export the canonical OrderStatus from shared/constants (matches DB enum exactly).
// Previously this file defined an 8-state UPPER_CASE enum that diverged from the
// PostgreSQL `order_status` type. Now unified to the single 14-state source of truth.
export { OrderStatus } from '@shared/constants/order-statuses';
import { OrderStatus } from '@shared/constants/order-statuses';

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

@Entity('orders')
@Index(['order_number'], { unique: true })
@Index(['customer_id'])
@Index(['status'])
@Index(['created_at'])
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  order_number!: string;

  @Column({ type: 'uuid' })
  customer_id!: string;

  @Column({ type: 'varchar', length: 255 })
  customer_name!: string;

  @Column({ type: 'varchar', length: 255 })
  customer_email!: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    default: OrderStatus.ORDER_CONFIRMED,
  })
  status!: OrderStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount_amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tax_rate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  shipping_cost!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grand_total!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'varchar', length: 50, default: 'NET30' })
  payment_terms!: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  payment_status!: PaymentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  proforma_number!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  invoice_number!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index('idx_orders_smartbill_invoice_id')
  smartbill_invoice_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index('idx_orders_smartbill_proforma_id')
  smartbill_proforma_id!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  woocommerce_order_id!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  billing_address!: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  shipping_address!: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  offline_synced_at!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  offline_original_timestamp!: Date | null;

  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: true,
    eager: false,
  })
  items!: OrderItemEntity[];

  @OneToMany(() => OrderStatusHistoryEntity, (history) => history.order, {
    cascade: true,
    eager: false,
  })
  status_history!: OrderStatusHistoryEntity[];
}
