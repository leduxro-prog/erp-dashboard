import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { JournalEntryEntity } from './JournalEntryEntity';
import { ChartOfAccountEntity } from './ChartOfAccountEntity';

@Entity('journal_entry_lines')
@Index('idx_jel_entry_id', ['journalEntryId'])
@Index('idx_jel_account_id', ['accountId'])
@Index('idx_jel_cost_center_id', ['costCenterId'])
export class JournalEntryLineEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  journalEntryId!: string;

  @Column('integer')
  lineNumber!: number;

  @Column('uuid')
  accountId!: string;

  @Column('uuid', { nullable: true })
  costCenterId!: string;

  @Column('uuid', { nullable: true })
  taxCodeId!: string;

  @Column('text', { nullable: true })
  description!: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  debitAmount!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  creditAmount!: number;

  @Column('numeric', { precision: 15, scale: 4, nullable: true })
  quantity!: number;

  @Column('numeric', { precision: 15, scale: 2, nullable: true })
  unitPrice!: number;

  @Column('varchar', { length: 100, nullable: true })
  referenceNumber!: string;

  @Column('jsonb', { default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => JournalEntryEntity, entry => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journalEntryId' })
  journalEntry!: JournalEntryEntity;

  @ManyToOne(() => ChartOfAccountEntity, account => account.journalEntryLines)
  @JoinColumn({ name: 'accountId' })
  account!: ChartOfAccountEntity;
}
