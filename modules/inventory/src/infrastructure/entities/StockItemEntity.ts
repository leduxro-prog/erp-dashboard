import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { WarehouseEntity } from './WarehouseEntity';

@Entity('stock_items')
@Index(['product_id', 'warehouse_id'], { unique: true })
@Index(['warehouse_id'])
export class StockItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  product_id!: string;

  @Column('uuid')
  warehouse_id!: string;

  @Column('integer')
  quantity!: number;

  @Column('integer', { default: 0 })
  reserved_quantity!: number;

  @Column('integer', { default: 0 })
  minimum_threshold!: number;

  @UpdateDateColumn()
  last_updated!: Date;

  @ManyToOne(() => WarehouseEntity, { eager: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: WarehouseEntity;
}
