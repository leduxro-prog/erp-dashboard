import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sales_kpi_daily')
@Index('idx_sales_kpi_daily_period_date_currency', ['periodDate', 'currency'], { unique: true })
@Index('idx_sales_kpi_daily_computed_at', ['computedAt'])
export class SalesKpiDailyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column('date', { name: 'period_date' })
  periodDate!: string;

  @Column('integer', { name: 'orders_count', default: 0 })
  ordersCount!: number;

  @Column('integer', { name: 'customers_count', default: 0 })
  customersCount!: number;

  @Column('decimal', { name: 'total_revenue', precision: 14, scale: 2, default: 0 })
  totalRevenue!: number;

  @Column('decimal', { name: 'total_without_vat', precision: 14, scale: 2, default: 0 })
  totalWithoutVat!: number;

  @Column('decimal', { name: 'vat_amount', precision: 14, scale: 2, default: 0 })
  vatAmount!: number;

  @Column('decimal', { name: 'average_order_value', precision: 14, scale: 2, default: 0 })
  averageOrderValue!: number;

  @Column('varchar', { name: 'currency', length: 8, default: 'RON' })
  currency!: string;

  @Column('jsonb', { name: 'top_products', default: () => "'[]'::jsonb" })
  topProducts!: Array<Record<string, unknown>>;

  @Column('timestamp with time zone', { name: 'computed_at', default: () => 'now()' })
  computedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
