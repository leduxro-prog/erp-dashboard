/**
 * MetricSnapshot TypeORM Entity
 * Maps domain MetricSnapshot entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('metric_snapshots')
@Index('idx_metric_snapshots_metric_name', ['metricName'])
@Index('idx_metric_snapshots_snapshot_time', ['snapshotTime'])
@Index('idx_metric_snapshots_created_at', ['createdAt'])
export class MetricSnapshotEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  metricName!: string;

  @Column('varchar', { length: 100, nullable: true })
  dimension?: string;

  @Column('decimal', { precision: 18, scale: 6 })
  value!: number;

  @Column('varchar', { length: 100, nullable: true })
  unit?: string;

  @Column('timestamp with time zone')
  snapshotTime!: Date;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
