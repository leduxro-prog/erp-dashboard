/**
 * BulkOrder TypeORM Entity
 * Maps domain BulkOrder entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('bulk_orders')
@Index('idx_bulk_orders_customer_id', ['customerId'])
@Index('idx_bulk_orders_status', ['status'])
@Index('idx_bulk_orders_created_at', ['createdAt'])
export class BulkOrderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column('varchar', { length: 100 })
  orderNumber!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  })
  status!: string;

  @Column('jsonb')
  items!: Record<string, unknown>;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount!: number;

  @Column('int', { default: 0 })
  itemCount!: number;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('timestamp with time zone', { nullable: true })
  confirmedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  shippedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  deliveredAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
