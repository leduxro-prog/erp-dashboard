/**
 * WhatsAppWebhookEvent TypeORM Entity
 * Maps domain WhatsAppWebhookEvent entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('whatsapp_webhook_events')
@Index('idx_whatsapp_webhook_events_message_id', ['messageId'])
@Index('idx_whatsapp_webhook_events_event_type', ['eventType'])
@Index('idx_whatsapp_webhook_events_created_at', ['createdAt'])
export class WhatsAppWebhookEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255, nullable: true })
  messageId?: string;

  @Column('varchar', { length: 100 })
  eventType!: string;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Column('boolean', { default: false })
  processed!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  processedAt?: Date;

  @Column('text', { nullable: true })
  processError?: string;

  @Column('int', { default: 0 })
  retryCount!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
