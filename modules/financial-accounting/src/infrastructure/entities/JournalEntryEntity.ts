import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { JournalEntryLineEntity } from './JournalEntryLineEntity';

@Entity('journal_entries')
@Index('idx_je_organization_id', ['organizationId'])
@Index('idx_je_fiscal_period_id', ['fiscalPeriodId'])
@Index('idx_je_entry_date', ['entryDate'])
@Index('idx_je_status', ['status'])
@Index('idx_je_posted', ['isPosted'])
export class JournalEntryEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  organizationId!: string;

  @Column('uuid')
  fiscalPeriodId!: string;

  @Column('varchar', { length: 50 })
  entryNumber!: string;

  @Column('date')
  entryDate!: Date;

  @Column('varchar', { length: 50, nullable: true })
  referenceType!: string;

  @Column('uuid', { nullable: true })
  referenceId!: string;

  @Column('text')
  description!: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  totalDebit!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  totalCredit!: number;

  @Column('varchar', { length: 50, default: 'DRAFT' })
  status!: string;

  @Column('boolean', { default: false })
  isPosted!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  postedDate!: Date;

  @Column('uuid', { nullable: true })
  postedBy!: string;

  @Column('varchar', { length: 50, default: 'PENDING' })
  approvalStatus!: string;

  @Column('uuid', { nullable: true })
  approvedBy!: string;

  @Column('timestamp with time zone', { nullable: true })
  approvedDate!: Date;

  @Column('uuid', { nullable: true })
  reversalEntryId!: string;

  @Column('jsonb', { default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('uuid')
  createdBy!: string;

  @Column('uuid')
  updatedBy!: string;

  @OneToMany(() => JournalEntryLineEntity, line => line.journalEntry, { cascade: true })
  lines!: JournalEntryLineEntity[];
}
