/**
 * B2BCustomer TypeORM Entity
 * Maps domain B2BCustomer entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('b2b_customers')
@Index('idx_b2b_customers_registration_id', ['registrationId'])
@Index('idx_b2b_customers_cui', ['cui'])
@Index('idx_b2b_customers_tier', ['tier'])
@Index('idx_b2b_customers_is_active', ['isActive'])
@Index('idx_b2b_customers_created_at', ['createdAt'])
export class B2BCustomerEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  registrationId!: string;

  @Column('varchar', { length: 255 })
  companyName!: string;

  @Column('varchar', { length: 50 })
  cui!: string;

  @Column({
    type: 'enum',
    enum: ['STANDARD', 'SILVER', 'GOLD', 'PLATINUM'],
  })
  tier!: string;

  @Column('decimal', { precision: 12, scale: 2 })
  creditLimit!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  usedCredit!: number;

  @Column('int', { default: 0 })
  paymentTermsDays!: number;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  lastOrderAt?: Date;

  @Column('int', { default: 0 })
  totalOrders!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalSpent!: number;

  @Column('uuid', { nullable: true })
  salesRepId?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
