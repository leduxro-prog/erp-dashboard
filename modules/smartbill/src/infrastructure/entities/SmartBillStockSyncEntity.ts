import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('smartbill_stock_syncs')
@Index('idx_warehouse_sku', ['warehouseName', 'productSku'])
@Index('idx_synced_at', ['syncedAt'])
export class SmartBillStockSyncEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('varchar')
  warehouseName!: string;

  @Column('varchar')
  productSku!: string;

  @Column('decimal', { precision: 10, scale: 2, transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) } })
  previousQuantity!: number;

  @Column('decimal', { precision: 10, scale: 2, transformer: { to: (value: number) => value, from: (value: string) => parseFloat(value) } })
  newQuantity!: number;

  @Column('boolean', { default: false })
  changed!: boolean;

  @Column('timestamp')
  syncedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
