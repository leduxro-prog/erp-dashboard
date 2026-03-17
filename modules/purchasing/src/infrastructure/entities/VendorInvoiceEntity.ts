import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vendor_invoices')
@Index('idx_vendor_invoice_number_unique', ['invoiceNumber'], { unique: true })
@Index('idx_inv_vendor_due', ['vendorId', 'dueDate'])
@Index('idx_inv_status', ['status'])
export class VendorInvoiceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 64 })
  invoiceNumber!: string;

  @Column('varchar', { length: 64 })
  vendorId!: string;

  @Column('varchar', { length: 64, nullable: true })
  poId!: string | null;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('date')
  invoiceDate!: Date;

  @Column('date')
  dueDate!: Date;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
