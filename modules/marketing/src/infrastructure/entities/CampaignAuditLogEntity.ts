/**
 * CampaignAuditLog TypeORM Entity
 * Audit trail for campaign lifecycle events
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('campaign_audit_log')
@Index('idx_campaign_audit_log_campaign_id', ['campaignId'])
@Index('idx_campaign_audit_log_action', ['action'])
@Index('idx_campaign_audit_log_actor_id', ['actorId'])
@Index('idx_campaign_audit_log_created_at', ['createdAt'])
export class CampaignAuditLogEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  campaignId!: string;

  @Column('varchar', { length: 100 })
  action!: string;

  @Column('uuid')
  actorId!: string;

  @Column('jsonb', { nullable: true })
  previousState?: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  newState?: Record<string, unknown>;

  @Column('jsonb', { default: {} })
  details!: Record<string, unknown>;

  @Column('varchar', { length: 45, nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
