/**
 * Forecast TypeORM Entity
 * Maps domain Forecast entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('forecasts')
@Index('idx_forecasts_metric_name', ['metricName'])
@Index('idx_forecasts_forecast_date', ['forecastDate'])
@Index('idx_forecasts_created_at', ['createdAt'])
export class ForecastEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  metricName!: string;

  @Column('timestamp with time zone')
  forecastDate!: Date;

  @Column('decimal', { precision: 18, scale: 6 })
  predictedValue!: number;

  @Column('decimal', { precision: 18, scale: 6, nullable: true })
  confidenceLower?: number;

  @Column('decimal', { precision: 18, scale: 6, nullable: true })
  confidenceUpper?: number;

  @Column('varchar', { length: 100, nullable: true })
  model?: string;

  @Column('int', { nullable: true })
  accuracy?: number;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
