import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SyncType, SyncStatus } from '../../domain/entities/SyncItem';

@Entity('wc_sync_items')
@Index(['status', 'createdAt'])
@Index(['productId'])
@Index(['syncType', 'status'])
export class SyncItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  productId!: string;

  @Column('integer', { nullable: true })
  wooCommerceId?: number;

  @Column('varchar')
  syncType!: SyncType;

  @Column('varchar')
  status!: SyncStatus;

  @Column('simple-json')
  payload!: any;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @Column('integer', { default: 0 })
  attempts!: number;

  @Column('integer', { default: 3 })
  maxAttempts!: number;

  @Column('timestamp', { nullable: true })
  lastAttempt?: Date;

  @Column('timestamp', { nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
