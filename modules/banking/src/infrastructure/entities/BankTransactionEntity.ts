import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { StatementImportEntity } from './StatementImportEntity';
import { BankAccountEntity } from './BankAccountEntity';

@Entity('bank_transactions')
export class BankTransactionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'importId' })
  importId!: number;

  @ManyToOne(() => StatementImportEntity)
  @JoinColumn({ name: 'importId' })
  import!: StatementImportEntity;

  @Column({ name: 'bankAccountId' })
  bankAccountId!: number;

  @ManyToOne(() => BankAccountEntity)
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount!: BankAccountEntity;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column()
  currency!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column('varchar', { nullable: true })
  reference!: string | null;

  @Column('varchar', { nullable: true })
  partnerName!: string | null;

  @Column('varchar', { nullable: true })
  partnerIban!: string | null;

  @Column()
  fingerprint!: string;

  @Column({ default: 'unmatched' })
  status!: 'unmatched' | 'matched' | 'ignored';

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'text', nullable: true })
  rawText!: string | null;
}
