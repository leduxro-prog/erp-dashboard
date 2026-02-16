/**
 * AudienceSegment TypeORM Entity
 * Persistent audience segment definitions
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('audience_segments')
@Index('idx_audience_segments_name', ['name'])
@Index('idx_audience_segments_created_by', ['createdBy'])
@Index('idx_audience_segments_created_at', ['createdAt'])
export class AudienceSegmentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('jsonb', { default: {} })
  filterCriteria!: Record<string, unknown>;

  @Column('int', { default: 0 })
  estimatedSize!: number;

  @Column('timestamp with time zone', { nullable: true })
  lastComputedAt?: Date;

  @Column('boolean', { default: true })
  isDynamic!: boolean;

  @Column('uuid', { array: true, default: '{}' })
  cachedCustomerIds!: string[];

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
