/**
 * B2BRegistration TypeORM Entity
 * Maps domain B2BRegistration entity to database table
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('b2b_registrations')
@Index('idx_b2b_registrations_email', ['email'])
@Index('idx_b2b_registrations_status', ['status'])
export class B2BRegistrationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column('varchar', { length: 255, name: 'company_name' })
  companyName!: string;

  @Column('varchar', { length: 100, name: 'tax_identification_number', nullable: true })
  cui?: string;

  @Column('varchar', { length: 100, name: 'registration_number', nullable: true })
  regCom?: string;

  @Column('varchar', { length: 255, name: 'email' })
  email!: string;

  @Column('varchar', { length: 255, name: 'contact_person_name' })
  contactPerson!: string;

  @Column('varchar', { length: 20, name: 'contact_person_phone', nullable: true })
  phone?: string;

  @Column('text', { name: 'legal_address', nullable: true })
  legalAddress?: string;

  @Column('text', { name: 'delivery_address', nullable: true })
  deliveryAddress?: string;

  @Column('varchar', { length: 255, name: 'bank_name', nullable: true })
  bankName?: string;

  @Column('varchar', { length: 50, name: 'iban', nullable: true })
  iban?: string;

  @Column('varchar', { length: 50, name: 'requested_tier', default: 'STANDARD', nullable: true })
  requestedTier?: string;

  @Column('integer', { name: 'payment_terms_days', nullable: true })
  paymentTermsDays?: number;

  @Column('text', { name: 'notes', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    name: 'status',
  })
  status!: string;

  @Column('bigint', { name: 'approved_by', nullable: true })
  approvedBy?: number;

  @Column('text', { name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  @Column('timestamp with time zone', { name: 'approved_at', nullable: true })
  approvedAt?: Date;

  @Column('timestamp with time zone', { name: 'submitted_at' })
  submittedAt!: Date;

  @Column('jsonb', { name: 'metadata', nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt!: Date;
}
