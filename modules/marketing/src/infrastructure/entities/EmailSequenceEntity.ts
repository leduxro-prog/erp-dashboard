/**
 * EmailSequence TypeORM Entity
 * Maps domain EmailSequence entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_sequences')
@Index('idx_email_sequences_campaign_id', ['campaignId'])
@Index('idx_email_sequences_status', ['status'])
@Index('idx_email_sequences_created_at', ['createdAt'])
export class EmailSequenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('uuid')
  campaignId!: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'],
  })
  status!: string;

  @Column('int')
  stepCount!: number;

  @Column('jsonb', { default: [] })
  steps!: Record<string, unknown>;

  @Column('int', { default: 0 })
  totalEmailsSent!: number;

  @Column('int', { default: 0 })
  totalOpens!: number;

  @Column('int', { default: 0 })
  totalClicks!: number;

  @Column('timestamp with time zone', { nullable: true })
  startedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
