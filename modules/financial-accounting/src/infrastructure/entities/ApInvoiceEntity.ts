import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ApInvoiceLineEntity } from './ApInvoiceLineEntity';

@Entity('ap_invoices')
@Index('idx_ap_invoices_org', ['organizationId'])
@Index('idx_ap_invoices_vendor', ['vendorId'])
@Index('idx_ap_invoices_status', ['status'])
@Index('idx_ap_invoices_due_date', ['dueDate'])
export class ApInvoiceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  organizationId!: string;

  @Column('uuid')
  vendorId!: string;

  @Column('varchar', { length: 50 })
  invoiceNumber!: string;

  @Column('varchar', { length: 50, nullable: true })
  poNumber!: string;

  @Column('varchar', { length: 50, nullable: true })
  grnNumber!: string;

  @Column('date')
  invoiceDate!: Date;

  @Column('date')
  dueDate!: Date;

  @Column('varchar', { length: 3, default: 'RON' })
  currencyCode!: string;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  subtotal!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  taxAmount!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  discountAmount!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  totalAmount!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  amountPaid!: number;

  @Column('numeric', { precision: 15, scale: 2, default: 0 })
  amountDue!: number;

  @Column('varchar', { length: 50, default: 'DRAFT' })
  status!: string;

  @Column('varchar', { length: 100, nullable: true })
  paymentTerms!: string;

  @Column('numeric', { precision: 5, scale: 2, nullable: true })
  discountPercent!: number;

  @Column('uuid', { nullable: true })
  taxCodeId!: string;

  @Column('text', { nullable: true })
  notes!: string;

  @Column('uuid')
  apAccountId!: string;

  @Column('uuid')
  expenseAccountId!: string;

  @Column('uuid', { nullable: true })
  journalEntryId!: string;

  @Column('varchar', { length: 50, default: 'PENDING' })
  threeWayMatchStatus!: string;

  @Column('numeric', { precision: 5, scale: 2, nullable: true })
  matchVariancePercent!: number;

  @Column('boolean', { default: false })
  isPosted!: boolean;

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

  @OneToMany(() => ApInvoiceLineEntity, (line) => line.invoice, { cascade: true })
  lines!: ApInvoiceLineEntity[];
}
