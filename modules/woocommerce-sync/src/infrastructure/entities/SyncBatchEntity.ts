import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BatchStatus } from '../../domain/entities/SyncBatch';

@Entity('wc_sync_batches')
@Index(['status', 'createdAt'])
export class SyncBatchEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar')
  status!: BatchStatus;

  @Column('integer', { default: 100 })
  batchSize!: number;

  @Column('timestamp', { nullable: true })
  startedAt?: Date;

  @Column('timestamp', { nullable: true })
  completedAt?: Date;

  @Column('integer', { default: 0 })
  totalItems!: number;

  @Column('integer', { default: 0 })
  successCount!: number;

  @Column('integer', { default: 0 })
  failCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
