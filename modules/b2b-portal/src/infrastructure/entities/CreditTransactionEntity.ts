/**
 * CreditTransaction TypeORM Entity
 * Maps domain CreditTransaction entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('credit_transactions')
@Index('idx_credit_transactions_customer_id', ['customerId'])
@Index('idx_credit_transactions_type', ['type'])
@Index('idx_credit_transactions_created_at', ['createdAt'])
export class CreditTransactionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column({
    type: 'enum',
    enum: ['DEBIT', 'CREDIT', 'ADJUSTMENT', 'REVERSAL'],
  })
  type!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balanceBefore!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balanceAfter!: number;

  @Column('text', { nullable: true })
  description?: string;

  @Column('varchar', { length: 255, nullable: true })
  referenceId?: string;

  @Column('uuid', { nullable: true })
  createdBy?: string;

  @Column('varchar', { length: 100, nullable: true })
  referenceType?: string;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
