/**
 * Report TypeORM Entity
 * Maps domain Report entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('reports')
@Index('idx_reports_type', ['type'])
@Index('idx_reports_created_by', ['createdBy'])
@Index('idx_reports_created_at', ['createdAt'])
export class ReportEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 100 })
  type!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('uuid')
  createdBy!: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
  })
  status!: string;

  @Column('jsonb')
  configuration!: Record<string, unknown>;

  @Column('jsonb', { nullable: true, default: {} })
  data?: Record<string, unknown>;

  @Column('timestamp with time zone', { nullable: true })
  generatedAt?: Date;

  @Column('int', { nullable: true })
  rowCount?: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
