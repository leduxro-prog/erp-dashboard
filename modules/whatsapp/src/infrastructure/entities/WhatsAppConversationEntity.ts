/**
 * WhatsAppConversation TypeORM Entity
 * Maps domain WhatsAppConversation entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('whatsapp_conversations')
@Index('idx_whatsapp_conversations_customer_id', ['customerId'])
@Index('idx_whatsapp_conversations_phone', ['phoneNumber'])
@Index('idx_whatsapp_conversations_status', ['status'])
@Index('idx_whatsapp_conversations_created_at', ['createdAt'])
export class WhatsAppConversationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  customerId?: string;

  @Column('varchar', { length: 20 })
  phoneNumber!: string;

  @Column('varchar', { length: 255, nullable: true })
  displayName?: string;

  @Column({
    type: 'enum',
    enum: ['OPEN', 'ASSIGNED', 'RESOLVED', 'ARCHIVED'],
  })
  status!: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'ARCHIVED';

  @Column('int', { default: 0 })
  messageCount!: number;

  @Column('int', { default: 0 })
  unreadCount!: number;

  @Column('simple-json', { nullable: true, default: [] })
  tags!: string[];

  @Column({
    type: 'enum',
    enum: ['LOW', 'NORMAL', 'HIGH'],
    default: 'NORMAL',
  })
  priority!: 'LOW' | 'NORMAL' | 'HIGH';

  @Column('uuid', { nullable: true })
  assignedTo?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('timestamp with time zone', { nullable: true })
  lastMessageAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  closedAt?: Date;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
