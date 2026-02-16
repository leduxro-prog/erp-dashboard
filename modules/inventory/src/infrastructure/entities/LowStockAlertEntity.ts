import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AlertSeverity {
  LOW = 'low',
  CRITICAL = 'critical',
}

@Entity('low_stock_alerts')
@Index(['product_id', 'warehouse_id'])
@Index(['warehouse_id'])
@Index(['acknowledged'])
@Index(['created_at'])
export class LowStockAlertEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  product_id!: string;

  @Column('varchar', { length: 100 })
  product_sku!: string;

  @Column('varchar', { length: 255 })
  product_name!: string;

  @Column('uuid')
  warehouse_id!: string;

  @Column('integer')
  current_quantity!: number;

  @Column('integer')
  minimum_threshold!: number;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
  })
  severity!: AlertSeverity;

  @Column('boolean', { default: false })
  acknowledged!: boolean;

  @Column('uuid', { nullable: true })
  acknowledged_by!: string;

  @Column('timestamp', { nullable: true })
  acknowledged_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
