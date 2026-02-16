/**
 * SeoIssue TypeORM Entity
 * Maps domain SeoIssue entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_issues')
@Index('idx_seo_issues_metadata_id', ['metadataId'])
@Index('idx_seo_issues_severity', ['severity'])
@Index('idx_seo_issues_created_at', ['createdAt'])
export class SeoIssueEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  metadataId!: string;

  @Column('varchar', { length: 100 })
  issueType!: string;

  @Column({
    type: 'enum',
    enum: ['CRITICAL', 'WARNING', 'INFO'],
  })
  severity!: string;

  @Column('text')
  message!: string;

  @Column('text', { nullable: true })
  suggestion?: string;

  @Column('boolean', { default: false })
  resolved!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  resolvedAt?: Date;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
