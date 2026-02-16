import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OrderEntity } from './OrderEntity';

@Entity('order_items')
@Index(['order_id'])
@Index(['product_id'])
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @Column({ type: 'uuid' })
  product_id!: string;

  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'varchar', length: 255 })
  product_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantity_delivered!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unit_price!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  line_total!: number;

  @Column({ type: 'uuid', nullable: true })
  source_warehouse_id!: string | null;

  /** Immutable cost price captured at the moment of sale */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, default: null })
  cost_price_snapshot!: number | null;

  /** Origin of the cost data (metadata, pricing_engine, estimated, etc.) */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  cost_source!: string | null;

  @ManyToOne(() => OrderEntity, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
}
