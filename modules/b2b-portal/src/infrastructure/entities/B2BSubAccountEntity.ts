import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { UserEntity } from '../../../../users/src/domain/entities/UserEntity';
import { B2BCustomerEntity } from './B2BCustomerEntity';

export interface B2BSubAccountPermissions {
  can_view_invoices: boolean;
  can_place_orders: boolean;
  order_approval_required: boolean;
}

@Entity('b2b_sub_accounts')
export class B2BSubAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'master_customer_id' })
  master_customer_id!: string;

  @ManyToOne(() => B2BCustomerEntity)
  @JoinColumn({ name: 'master_customer_id' })
  master_customer!: B2BCustomerEntity;

  @Column('integer', { name: 'user_id' })
  user_id!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column('jsonb', {
    name: 'permissions',
    default: {
      can_view_invoices: false,
      can_place_orders: true,
      order_approval_required: true,
    },
  })
  permissions!: B2BSubAccountPermissions;

  @Column('decimal', { name: 'monthly_limit', precision: 12, scale: 2, default: 0 })
  monthly_limit!: number;

  @Column('decimal', { name: 'current_month_spend', precision: 12, scale: 2, default: 0 })
  current_month_spend!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
