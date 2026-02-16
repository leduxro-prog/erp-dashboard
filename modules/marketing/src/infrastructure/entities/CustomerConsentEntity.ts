/**
 * CustomerConsent TypeORM Entity
 * Per-channel consent tracking
 */
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('customer_consents')
@Index('idx_customer_consents_customer_id', ['customerId'])
@Index('idx_customer_consents_channel', ['channel'])
@Index('idx_customer_consents_opted_in', ['isOptedIn'])
export class CustomerConsentEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column('varchar', { length: 50 })
  channel!: string;

  @Column('boolean', { default: false })
  isOptedIn!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  optedInAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  optedOutAt?: Date;

  @Column('varchar', { length: 255, nullable: true })
  consentSource?: string;

  @Column('varchar', { length: 45, nullable: true })
  ipAddress?: string;

  @Column('jsonb', { default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
