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

export interface B2BProjectMetadata {
  description?: string;
  external_reference?: string;
  tags?: string[];
  [key: string]: any;
}

@Entity('b2b_projects')
export class B2BProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'customer_id' })
  customer_id!: string;

  @ManyToOne(() => B2BCustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: B2BCustomerEntity;

  @Column('integer', { name: 'creator_id' })
  creator_id!: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'creator_id' })
  creator!: UserEntity;

  @Column('varchar', { name: 'name', length: 255 })
  name!: string;

  @Column('boolean', { name: 'is_shared', default: false })
  is_shared!: boolean;

  @Column('jsonb', { name: 'metadata', default: {} })
  metadata!: B2BProjectMetadata;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
