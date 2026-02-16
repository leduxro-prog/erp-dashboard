/**
 * Campaign TypeORM Entity
 * Maps domain Campaign entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('campaigns')
@Index('idx_campaigns_type', ['type'])
@Index('idx_campaigns_status', ['status'])
@Index('idx_campaigns_created_at', ['createdAt'])
@Index('idx_campaigns_start_date', ['startDate'])
@Index('idx_campaigns_end_date', ['endDate'])
export class CampaignEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column({
    type: 'enum',
    enum: ['EMAIL_BLAST', 'DISCOUNT_CODE', 'PRODUCT_LAUNCH', 'SEASONAL', 'FLASH_SALE', 'NEWSLETTER'],
  })
  type!: string;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
  })
  status!: string;

  @Column('text')
  description!: string;

  @Column('jsonb', { nullable: true, default: {} })
  targetAudience?: Record<string, unknown>;

  @Column('timestamp with time zone')
  startDate!: Date;

  @Column('timestamp with time zone')
  endDate!: Date;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  budget?: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  spentBudget!: number;

  @Column('jsonb', { default: { sent: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 } })
  metrics!: Record<string, unknown>;

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
