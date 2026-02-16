import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('fiscal_periods')
@Index('idx_fiscal_periods_org', ['organizationId'])
@Index('idx_fiscal_periods_dates', ['startDate', 'endDate'])
export class FiscalPeriodEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  organizationId!: string;

  @Column('varchar', { length: 50 })
  periodName!: string;

  @Column('varchar', { length: 4 })
  fiscalYear!: string;

  @Column('date')
  startDate!: Date;

  @Column('date')
  endDate!: Date;

  @Column('boolean', { default: true })
  isOpen!: boolean;

  @Column('boolean', { default: false })
  isLocked!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  closingDate!: Date;

  @Column('uuid', { nullable: true })
  closedBy!: string;

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
}
