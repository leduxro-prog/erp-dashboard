import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { QuoteStatus, QuoteItem } from '../../domain/entities/Quote';

@Entity('quotes')
@Index(['customerId'])
@Index(['status'])
@Index(['validUntil'])
@Index(['quoteNumber'], { unique: true })
export class QuoteEntity {
  @PrimaryColumn({ name: 'id', type: 'bigint' })
  id!: string;

  @Column({ name: 'quote_number' })
  quoteNumber!: string;

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: string;

  // Stored in metadata.customerName
  customerName!: string;

  // Stored in metadata.customerEmail
  customerEmail!: string;

  @Column({ type: 'varchar', name: 'status' })
  status!: QuoteStatus;

  // Stored in metadata.items
  items!: QuoteItem[];

  // Stored in metadata.billingAddress
  billingAddress!: any;

  // Stored in metadata.shippingAddress
  shippingAddress!: any;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'subtotal' })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'discount_amount' })
  discountAmount!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'discount_percentage' })
  discountPercentage!: number;

  // Stored in metadata.taxRate
  taxRate!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'tax_amount' })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  grandTotal!: number;

  @Column({ name: 'currency_code' })
  currency!: string;

  @Column({ name: 'terms_and_conditions', nullable: true, type: 'text' })
  paymentTerms!: string;

  // Stored in metadata.deliveryEstimate
  deliveryEstimate!: string;

  // Calculated from quote_date and expiry_date
  validityDays!: number;

  @Column({ type: 'date', name: 'expiry_date' })
  validUntil!: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'viewed_at' })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'accepted_at' })
  acceptedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'declined_at' })
  rejectedAt?: Date;

  @Column({ nullable: true, name: 'declined_reason', type: 'text' })
  rejectionReason?: string;

  @Column({ nullable: true, name: 'notes', type: 'text' })
  notes?: string;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: string;

  @Column({ type: 'jsonb', name: 'metadata', default: '{}' })
  metadata!: Record<string, any>;

  @Column({ type: 'date', name: 'quote_date' })
  quoteDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
