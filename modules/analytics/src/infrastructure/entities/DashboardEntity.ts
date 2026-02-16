/**
 * Dashboard TypeORM Entity
 * Maps domain Dashboard entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('dashboards')
@Index('idx_dashboards_owner_id', ['ownerId'])
@Index('idx_dashboards_is_default', ['isDefault'])
@Index('idx_dashboards_is_shared', ['isShared'])
@Index('idx_dashboards_created_at', ['createdAt'])
export class DashboardEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('uuid')
  ownerId!: string;

  @Column('boolean', { default: false })
  isDefault!: boolean;

  @Column('boolean', { default: false })
  isShared!: boolean;

  @Column({
    type: 'enum',
    enum: ['GRID', 'FREEFORM'],
    default: 'GRID',
  })
  layout!: string;

  @Column('jsonb', { default: [] })
  widgets!: Record<string, unknown>;

  @Column('jsonb', { nullable: true, default: {} })
  filters?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
