/**
 * SeoAuditResult TypeORM Entity
 * Maps domain SeoAuditResult entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_audit_results')
@Index('idx_seo_audit_results_metadata_id', ['metadataId'])
@Index('idx_seo_audit_results_status', ['status'])
@Index('idx_seo_audit_results_created_at', ['createdAt'])
export class SeoAuditResultEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  metadataId!: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
  })
  status!: string;

  @Column('int', { nullable: true })
  score?: number;

  @Column('jsonb', { default: [] })
  issues!: Record<string, unknown>;

  @Column('jsonb', { nullable: true, default: {} })
  recommendations?: Record<string, unknown>;

  @Column('int', { nullable: true })
  performanceScore?: number;

  @Column('int', { nullable: true })
  accessibilityScore?: number;

  @Column('int', { nullable: true })
  seoScore?: number;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column('timestamp with time zone', { nullable: true })
  startedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
