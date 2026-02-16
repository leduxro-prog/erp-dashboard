import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { JournalEntryLineEntity } from './JournalEntryLineEntity';

@Entity('chart_of_accounts')
@Index('idx_coa_organization_id', ['organizationId'])
@Index('idx_coa_account_type', ['accountType'])
@Index('idx_coa_parent_id', ['parentAccountId'])
@Index('idx_coa_is_active', ['isActive'])
export class ChartOfAccountEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  organizationId!: string;

  @Column('varchar', { length: 50 })
  code!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description!: string;

  @Column('varchar', { length: 50 })
  accountType!: string;

  @Column('uuid', { nullable: true })
  parentAccountId!: string;

  @Column('boolean', { default: false })
  isHeader!: boolean;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('varchar', { length: 50, nullable: true })
  costCenterCode!: string;

  @Column('boolean', { default: false })
  taxApplicable!: boolean;

  @Column('boolean', { default: false })
  accumulatedDepreciation!: boolean;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  balance!: number;

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

  @OneToMany(() => JournalEntryLineEntity, line => line.account)
  journalEntryLines!: JournalEntryLineEntity[];
}
