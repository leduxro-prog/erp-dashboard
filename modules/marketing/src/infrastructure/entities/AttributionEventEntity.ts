/**
 * AttributionEvent TypeORM Entity
 * Attribution data with UTM/conversion tracking
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('attribution_events')
@Index('idx_attribution_events_campaign_id', ['campaignId'])
@Index('idx_attribution_events_customer_id', ['customerId'])
@Index('idx_attribution_events_channel', ['channel'])
@Index('idx_attribution_events_conversion', ['isConversion'])
@Index('idx_attribution_events_order_id', ['orderId'])
@Index('idx_attribution_events_touchpoint_at', ['touchpointAt'])
@Index('idx_attribution_events_created_at', ['createdAt'])
export class AttributionEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  campaignId?: string;

  @Column('uuid')
  customerId!: string;

  @Column('varchar', { length: 50 })
  channel!: string;

  @Column({
    type: 'enum',
    enum: ['FIRST_TOUCH', 'LAST_TOUCH', 'ASSISTED', 'LINEAR', 'TIME_DECAY'],
    default: 'LAST_TOUCH',
  })
  attributionType!: string;

  @Column('varchar', { length: 100 })
  touchpointType!: string;

  @Column('varchar', { length: 1024, nullable: true })
  touchpointUrl?: string;

  @Column('varchar', { length: 255, nullable: true })
  utmSource?: string;

  @Column('varchar', { length: 255, nullable: true })
  utmMedium?: string;

  @Column('varchar', { length: 255, nullable: true })
  utmCampaign?: string;

  @Column('varchar', { length: 255, nullable: true })
  utmContent?: string;

  @Column('varchar', { length: 255, nullable: true })
  utmTerm?: string;

  @Column('varchar', { length: 255, nullable: true })
  clickId?: string;

  @Column('uuid', { nullable: true })
  orderId?: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  revenue!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  cost!: number;

  @Column('boolean', { default: false })
  isConversion!: boolean;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  conversionValue?: number;

  @Column('varchar', { length: 255, nullable: true })
  sessionId?: string;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @Column('timestamp with time zone', { default: () => 'NOW()' })
  touchpointAt!: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
