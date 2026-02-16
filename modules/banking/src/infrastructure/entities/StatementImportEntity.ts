import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BankAccountEntity } from './BankAccountEntity';

@Entity('bank_statement_imports')
export class StatementImportEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'bankAccountId' })
  bankAccountId!: number;

  @ManyToOne(() => BankAccountEntity)
  @JoinColumn({ name: 'bankAccountId' })
  bankAccount!: BankAccountEntity;

  @Column()
  filename!: string;

  @Column()
  fileHash!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'processed' | 'failed';

  @Column({ nullable: true })
  importedBy!: string;

  @CreateDateColumn({ name: 'importDate' })
  importDate!: Date;

  @Column({ type: 'date', nullable: true })
  periodStart!: Date | null;

  @Column({ type: 'date', nullable: true })
  periodEnd!: Date | null;

  @Column({ default: 0 })
  transactionCount!: number;
}
