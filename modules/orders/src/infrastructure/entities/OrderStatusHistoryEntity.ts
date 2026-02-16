import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { OrderEntity, OrderStatus } from './OrderEntity';

@Entity('order_status_history')
@Index(['order_id'])
@Index(['changed_at'])
export class OrderStatusHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @Column({ type: 'varchar', length: 50 })
  from_status!: OrderStatus;

  @Column({ type: 'varchar', length: 50 })
  to_status!: OrderStatus;

  @Column({ type: 'uuid', nullable: true })
  changed_by!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  changed_at!: Date;

  @ManyToOne(() => OrderEntity, (order) => order.status_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
}
