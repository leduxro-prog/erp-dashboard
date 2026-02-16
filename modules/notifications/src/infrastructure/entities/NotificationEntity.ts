/**
 * Notification TypeORM Entity
 * Maps domain Notification entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notifications')
@Index('idx_notifications_recipient_id', ['recipientId'])
@Index('idx_notifications_status', ['status'])
@Index('idx_notifications_created_at', ['createdAt'])
@Index('idx_notifications_channel', ['channel'])
@Index('idx_notifications_scheduled_at', ['scheduledAt'])
@Index('idx_notifications_status_scheduled', ['status', 'scheduledAt'])
export class NotificationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'],
  })
  type!: string;

  @Column({
    type: 'enum',
    enum: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'],
  })
  channel!: string;

  @Column('varchar', { length: 255 })
  recipientId!: string;

  @Column('varchar', { length: 255, nullable: true })
  recipientEmail?: string;

  @Column('varchar', { length: 20, nullable: true })
  recipientPhone?: string;

  @Column('varchar', { length: 255 })
  subject!: string;

  @Column('text')
  body!: string;

  @Column('uuid', { nullable: true })
  templateId?: string;

  @Column('jsonb', { nullable: true, default: {} })
  templateData?: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'],
  })
  status!: string;

  @Column({
    type: 'enum',
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
  })
  priority!: string;

  @Column('timestamp with time zone', { nullable: true })
  scheduledAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  sentAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  deliveredAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  failedAt?: Date;

  @Column('text', { nullable: true })
  failureReason?: string;

  @Column('int', { default: 0 })
  retryCount!: number;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
