import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ArInvoiceEntity } from './ArInvoiceEntity';

@Entity('ar_invoice_lines')
@Index('idx_ar_invoice_lines_invoice', ['arInvoiceId'])
export class ArInvoiceLineEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  arInvoiceId!: string;

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
  revenueAccountId!: string;

  @Column('uuid', { nullable: true })
  taxCodeId!: string;

  @Column('jsonb', { default: '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => ArInvoiceEntity, invoice => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'arInvoiceId' })
  invoice!: ArInvoiceEntity;
}
