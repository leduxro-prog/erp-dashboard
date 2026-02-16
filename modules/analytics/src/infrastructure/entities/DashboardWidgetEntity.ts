/**
 * DashboardWidget TypeORM Entity
 * Maps domain DashboardWidget entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('dashboard_widgets')
@Index('idx_dashboard_widgets_dashboard_id', ['dashboardId'])
@Index('idx_dashboard_widgets_type', ['type'])
@Index('idx_dashboard_widgets_created_at', ['createdAt'])
export class DashboardWidgetEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  dashboardId!: string;

  @Column('varchar', { length: 100 })
  type!: string;

  @Column('varchar', { length: 255 })
  title!: string;

  @Column('varchar', { length: 100 })
  dataSourceType!: string;

  @Column('jsonb')
  query!: Record<string, unknown>;

  @Column('jsonb', { nullable: true, default: {} })
  position?: Record<string, unknown>;

  @Column('int', { nullable: true })
  refreshInterval?: number;

  @Column('jsonb', { nullable: true, default: {} })
  cachedData?: Record<string, unknown>;

  @Column('timestamp with time zone', { nullable: true })
  lastRefreshedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
