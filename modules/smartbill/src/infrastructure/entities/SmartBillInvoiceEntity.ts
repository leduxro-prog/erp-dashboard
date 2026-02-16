import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { InvoiceStatus, SmartBillApiInvoiceStatus } from '../../domain/entities/SmartBillInvoice';

@Entity('smartbill_invoices')
@Index('idx_order_id', ['orderId'])
@Index('idx_smartbill_id', ['smartBillId'])
@Index('idx_status', ['status'])
@Index('idx_smartbill_status', ['smartBillStatus'])
export class SmartBillInvoiceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('varchar')
  orderId!: string;

  @Column('varchar', { nullable: true })
  smartBillId!: string | null;

  @Column('varchar', { nullable: true })
  invoiceNumber!: string | null;

  @Column('varchar', { default: 'FL' })
  series!: string;

  @Column('varchar')
  customerName!: string;

  @Column('varchar')
  customerVat!: string;

  @Column('simple-json')
  items!: any[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalWithoutVat!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  vatAmount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalWithVat!: number;

  @Column('varchar', { default: 'RON' })
  currency!: string;

  @Column({ type: 'varchar', default: 'draft' })
  status!: InvoiceStatus;

  @Column({ type: 'varchar', nullable: true })
  smartBillStatus!: SmartBillApiInvoiceStatus | null;

  @Column('timestamp')
  issueDate!: Date;

  @Column('timestamp')
  dueDate!: Date;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  paidAmount!: number;

  @Column('timestamp', { nullable: true })
  paymentDate!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  markPaid(amount?: number, date?: Date) {
    this.status = 'paid' as InvoiceStatus;
    this.paidAmount = amount || this.totalWithVat;
    this.paymentDate = date || new Date();
  }

  updateSmartBillStatus(status: SmartBillApiInvoiceStatus) {
    this.smartBillStatus = status;
  }
}
