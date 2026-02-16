import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReservationStatus {
  ACTIVE = 'active',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface ReservedItem {
  product_id: string;
  quantity: number;
  warehouse_id: string;
}

@Entity('stock_reservations')
@Index(['order_id'])
@Index(['status'])
@Index(['expires_at'])
export class StockReservationEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  order_id!: string;

  @Column('jsonb')
  items!: ReservedItem[];

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.ACTIVE,
  })
  status!: ReservationStatus;

  @Column('timestamp')
  expires_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
