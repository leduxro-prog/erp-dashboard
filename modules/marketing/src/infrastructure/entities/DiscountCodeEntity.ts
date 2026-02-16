/**
 * DiscountCode TypeORM Entity
 * Maps domain DiscountCode entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('discount_codes')
@Index('idx_discount_codes_code', ['code'])
@Index('idx_discount_codes_campaign_id', ['campaignId'])
@Index('idx_discount_codes_is_active', ['isActive'])
@Index('idx_discount_codes_created_at', ['createdAt'])
export class DiscountCodeEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 100 })
  code!: string;

  @Column('uuid', { nullable: true })
  campaignId?: string;

  @Column({
    type: 'enum',
    enum: ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'],
  })
  type!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  value!: number;

  @Column('int', { nullable: true })
  maxUsageCount?: number;

  @Column('int', { default: 0 })
  usedCount!: number;

  @Column('int', { nullable: true })
  maxUsagePerCustomer?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  minOrderValue?: number;

  @Column('timestamp with time zone')
  startDate!: Date;

  @Column('timestamp with time zone')
  endDate!: Date;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('jsonb', { nullable: true, default: {} })
  restrictions?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
