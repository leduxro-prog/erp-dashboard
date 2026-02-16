import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum StockMovementType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
  RESERVATION = 'reservation',
  RELEASE = 'release',
  LOSS = 'loss',
}

export enum ReferenceType {
  PURCHASE_ORDER = 'purchase_order',
  SALES_ORDER = 'sales_order',
  STOCK_TRANSFER = 'stock_transfer',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  SUPPLIER_RETURN = 'supplier_return',
}

@Entity('stock_movements')
@Index(['product_id', 'warehouse_id'])
@Index(['warehouse_id'])
@Index(['created_at'])
@Index(['reference_type', 'reference_id'])
export class StockMovementEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  product_id!: string;

  @Column('uuid')
  warehouse_id!: string;

  @Column({
    type: 'enum',
    enum: StockMovementType,
  })
  movement_type!: StockMovementType;

  @Column('integer')
  quantity!: number;

  @Column('integer')
  previous_quantity!: number;

  @Column('integer')
  new_quantity!: number;

  @Column('varchar', { nullable: true })
  reason!: string;

  @Column({
    type: 'enum',
    enum: ReferenceType,
    nullable: true,
  })
  reference_type!: ReferenceType;

  @Column('varchar', { nullable: true })
  reference_id!: string;

  @Column('uuid')
  created_by!: string;

  @CreateDateColumn()
  created_at!: Date;
}
