import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApInvoiceEntity } from './ApInvoiceEntity';

@Entity('ap_invoice_lines')
@Index('idx_ap_invoice_lines_invoice', ['apInvoiceId'])
export class ApInvoiceLineEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  apInvoiceId!: string;

  @Column('integer')
  lineNumber!: number;

  @Column('text')
  description!: string;

  @Column('numeric', { precision: 15, scale: 4 })
  quantity!: number;

  @Column('numeric', { precision: 15, scale: 2 })
  unitPrice!: number;

  @Column('numeric', { precision: 15, scale: 2 })
  amount!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  taxAmount!: number;

  @Column('uuid')
  expenseAccountId!: string;

  @Column('uuid', { nullable: true })
  taxCodeId!: string;

  @Column('uuid', { nullable: true })
  costCenterId!: string;

  @Column('uuid', { nullable: true })
  poLineId!: string;

  @Column('uuid', { nullable: true })
  grnLineId!: string;

  @Column('jsonb', { default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => ApInvoiceEntity, invoice => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'apInvoiceId' })
  invoice!: ApInvoiceEntity;
}
