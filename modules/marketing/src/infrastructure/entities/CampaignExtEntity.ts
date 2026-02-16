/**
 * CampaignExt TypeORM Entity
 * Extended campaign data for multi-channel orchestration
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('marketing_campaigns_ext')
@Index('idx_campaigns_ext_campaign_id', ['campaignId'])
@Index('idx_campaigns_ext_schedule_type', ['scheduleType'])
@Index('idx_campaigns_ext_scheduled_at', ['scheduledAt'])
export class CampaignExtEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  campaignId!: string;

  @Column('text', { array: true, default: '{}' })
  channels!: string[];

  @Column('varchar', { length: 50, default: 'IMMEDIATE' })
  scheduleType!: string;

  @Column('timestamp with time zone', { nullable: true })
  scheduledAt?: Date;

  @Column('varchar', { length: 100, default: 'Europe/Bucharest' })
  timezone!: string;

  @Column('jsonb', { nullable: true })
  recurrenceRule?: Record<string, unknown>;

  @Column('int', { default: 3 })
  frequencyCapPerContact!: number;

  @Column('int', { default: 168 })
  frequencyCapWindowHours!: number;

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

  @Column('jsonb', { nullable: true })
  abTestConfig?: Record<string, unknown>;

  @Column('int', { default: 5 })
  priority!: number;

  @Column('text', { array: true, default: '{}' })
  tags!: string[];

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
