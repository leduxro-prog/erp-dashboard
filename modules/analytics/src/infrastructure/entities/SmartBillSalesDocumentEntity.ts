import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('smartbill_sales_documents')
@Index('idx_smartbill_sales_documents_document_key', ['documentKey'], { unique: true })
@Index('idx_smartbill_sales_documents_issue_date', ['issueDate'])
@Index('idx_smartbill_sales_documents_type_issue_date', ['documentType', 'issueDate'])
export class SmartBillSalesDocumentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column('varchar', { name: 'document_key', length: 191 })
  documentKey!: string;

  @Column('varchar', { name: 'document_type', length: 32 })
  documentType!: string;

  @Column('varchar', { name: 'smartbill_id', length: 128, nullable: true })
  smartbillId?: string;

  @Column('varchar', { name: 'series', length: 32, nullable: true })
  series?: string;

  @Column('varchar', { name: 'number', length: 64, nullable: true })
  number?: string;

  @Column('date', { name: 'issue_date' })
  issueDate!: string;

  @Column('date', { name: 'due_date', nullable: true })
  dueDate?: string;

  @Column('varchar', { name: 'customer_name', length: 255, nullable: true })
  customerName?: string;

  @Column('varchar', { name: 'customer_vat', length: 64, nullable: true })
  customerVat?: string;

  @Column('varchar', { name: 'currency', length: 8, default: 'RON' })
  currency!: string;

  @Column('decimal', { name: 'total_without_vat', precision: 14, scale: 2, default: 0 })
  totalWithoutVat!: number;

  @Column('decimal', { name: 'vat_amount', precision: 14, scale: 2, default: 0 })
  vatAmount!: number;

  @Column('decimal', { name: 'total_with_vat', precision: 14, scale: 2, default: 0 })
  totalWithVat!: number;

  @Column('jsonb', { name: 'payload', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @Column('timestamp with time zone', { name: 'source_updated_at', nullable: true })
  sourceUpdatedAt?: Date;

  @Column('timestamp with time zone', { name: 'ingested_at', default: () => 'now()' })
  ingestedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
