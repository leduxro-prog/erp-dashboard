/**
 * ChannelDelivery TypeORM Entity
 * Per-delivery tracking per channel
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('channel_deliveries')
@Index('idx_channel_deliveries_campaign_id', ['campaignId'])
@Index('idx_channel_deliveries_step_id', ['stepId'])
@Index('idx_channel_deliveries_customer_id', ['customerId'])
@Index('idx_channel_deliveries_status', ['status'])
@Index('idx_channel_deliveries_channel', ['channel'])
@Index('idx_channel_deliveries_sent_at', ['sentAt'])
@Index('idx_channel_deliveries_created_at', ['createdAt'])
export class ChannelDeliveryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  campaignId!: string;

  @Column('uuid', { nullable: true })
  stepId?: string;

  @Column('uuid')
  customerId!: string;

  @Column('varchar', { length: 50 })
  channel!: string;

  @Column({
    type: 'enum',
    enum: [
      'QUEUED',
      'SENDING',
      'SENT',
      'DELIVERED',
      'OPENED',
      'CLICKED',
      'BOUNCED',
      'FAILED',
      'UNSUBSCRIBED',
      'RETRYING',
    ],
    default: 'QUEUED',
  })
  status!: string;

  @Column('varchar', { length: 512 })
  recipientAddress!: string;

  @Column('varchar', { length: 255, nullable: true })
  templateId?: string;

  @Column('jsonb', { default: {} })
  templateData!: Record<string, unknown>;

  @Column('varchar', { length: 255, nullable: true })
  externalMessageId?: string;

  @Column('timestamp with time zone', { nullable: true })
  sentAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  deliveredAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  openedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  clickedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  failedAt?: Date;

  @Column('text', { nullable: true })
  failureReason?: string;

  @Column('int', { default: 0 })
  retryCount!: number;

  @Column('int', { default: 3 })
  maxRetries!: number;

  @Column('decimal', { precision: 10, scale: 4, default: 0 })
  cost!: number;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
