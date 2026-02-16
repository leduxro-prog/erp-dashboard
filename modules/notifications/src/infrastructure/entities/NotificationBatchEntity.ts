/**
 * NotificationBatch TypeORM Entity
 * Maps domain NotificationBatch entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_batches')
@Index('idx_notification_batches_status', ['status'])
@Index('idx_notification_batches_created_at', ['createdAt'])
export class NotificationBatchEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('uuid', { array: true, default: [] })
  notifications!: string[];

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  status!: string;

  @Column('int', { default: 0 })
  totalCount!: number;

  @Column('int', { default: 0 })
  sentCount!: number;

  @Column('int', { default: 0 })
  failedCount!: number;

  @Column('timestamp with time zone', { nullable: true })
  startedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
