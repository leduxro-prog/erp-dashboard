/**
 * ConfiguratorSession TypeORM Entity
 * Maps domain ConfiguratorSession entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('configurator_sessions')
@Index('idx_configurator_sessions_customer_id', ['customerId'])
@Index('idx_configurator_sessions_status', ['status'])
@Index('idx_configurator_sessions_created_at', ['createdAt'])
@Index('idx_configurator_sessions_expires_at', ['expiresAt'])
export class ConfiguratorSessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 50 })
  type!: string;

  @Column('varchar', { length: 255, nullable: true })
  customerId?: string;

  @Column('varchar', { length: 255 })
  sessionToken!: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED'],
  })
  status!: string;

  @Column('jsonb', { nullable: true, default: {} })
  items?: Record<string, unknown>;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalPrice!: number;

  @Column('timestamp with time zone', { nullable: true })
  validatedAt?: Date;

  @Column('timestamp with time zone')
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
