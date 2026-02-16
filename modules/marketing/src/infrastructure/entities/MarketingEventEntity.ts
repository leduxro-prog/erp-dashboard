/**
 * MarketingEvent TypeORM Entity
 * Maps domain MarketingEvent entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('marketing_events')
@Index('idx_marketing_events_customer_id', ['customerId'])
@Index('idx_marketing_events_event_type', ['eventType'])
@Index('idx_marketing_events_created_at', ['createdAt'])
export class MarketingEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  customerId?: string;

  @Column('varchar', { length: 100 })
  eventType!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('jsonb', { nullable: true, default: {} })
  data?: Record<string, unknown>;

  @Column('varchar', { length: 255, nullable: true })
  campaignId?: string;

  @Column('varchar', { length: 255, nullable: true })
  sourceChannel?: string;

  @Column('boolean', { default: false })
  processed!: boolean;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
