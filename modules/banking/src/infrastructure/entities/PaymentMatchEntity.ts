import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BankTransactionEntity } from './BankTransactionEntity';

@Entity('payment_matches')
export class PaymentMatchEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'transactionId' })
  transactionId!: number;

  @ManyToOne(() => BankTransactionEntity)
  @JoinColumn({ name: 'transactionId' })
  transaction!: BankTransactionEntity;

  @Column()
  matchType!: 'invoice' | 'proforma' | 'order';

  @Column()
  matchId!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence!: number;

  @Column({ default: 'suggested' })
  status!: 'suggested' | 'confirmed' | 'rejected';

  @Column({ default: 'system' })
  matchedBy!: string;

  @CreateDateColumn({ name: 'matchedAt' })
  matchedAt!: Date;
}
