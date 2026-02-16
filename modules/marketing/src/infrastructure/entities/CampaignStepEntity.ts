/**
 * CampaignStep TypeORM Entity
 * Steps within a multi-step campaign journey
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('campaign_steps')
@Index('idx_campaign_steps_campaign_id', ['campaignId'])
@Index('idx_campaign_steps_status', ['status'])
export class CampaignStepEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  campaignId!: string;

  @Column('int')
  stepOrder!: number;

  @Column({
    type: 'enum',
    enum: [
      'SEND_EMAIL',
      'SEND_SMS',
      'SEND_WHATSAPP',
      'SEND_PUSH',
      'WAIT',
      'CONDITION',
      'SPLIT',
      'WEBHOOK',
    ],
  })
  stepType!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED', 'FAILED'],
    default: 'PENDING',
  })
  status!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 50, nullable: true })
  channel?: string;

  @Column('varchar', { length: 255, nullable: true })
  templateId?: string;

  @Column('jsonb', { default: {} })
  templateData!: Record<string, unknown>;

  @Column('int', { default: 0 })
  delayMinutes!: number;

  @Column('jsonb', { nullable: true })
  conditionRules?: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  splitConfig?: Record<string, unknown>;

  @Column('varchar', { length: 512, nullable: true })
  webhookUrl?: string;

  @Column('int', { default: 0 })
  retryCount!: number;

  @Column('int', { default: 3 })
  maxRetries!: number;

  @Column('timestamp with time zone', { nullable: true })
  startedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  completedAt?: Date;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
