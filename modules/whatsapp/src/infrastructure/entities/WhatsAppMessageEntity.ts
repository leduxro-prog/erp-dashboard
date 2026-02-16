/**
 * WhatsAppMessage TypeORM Entity
 * Maps domain WhatsAppMessage entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('whatsapp_messages')
@Index('idx_whatsapp_messages_conversation_id', ['conversationId'])
@Index('idx_whatsapp_messages_direction', ['direction'])
@Index('idx_whatsapp_messages_status', ['status'])
@Index('idx_whatsapp_messages_created_at', ['createdAt'])
export class WhatsAppMessageEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  conversationId!: string;

  @Column({
    type: 'enum',
    enum: ['INBOUND', 'OUTBOUND'],
  })
  direction!: string;

  @Column({
    type: 'enum',
    enum: ['TEXT', 'TEMPLATE', 'IMAGE', 'DOCUMENT', 'INTERACTIVE'],
  })
  messageType!: string;

  @Column('varchar', { length: 20 })
  recipientPhone!: string;

  @Column('varchar', { length: 20 })
  senderPhone!: string;

  @Column('text')
  content!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
  })
  status!: string;

  @Column('varchar', { length: 255, nullable: true })
  templateName?: string;

  @Column('jsonb', { nullable: true, default: {} })
  templateData?: Record<string, string>;

  @Column('varchar', { length: 512, nullable: true })
  mediaUrl?: string;

  @Column('varchar', { length: 50, nullable: true })
  mediaType?: string;

  @Column('varchar', { length: 255, nullable: true })
  whatsappMessageId?: string;

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
