/**
 * SavedCart TypeORM Entity
 * Maps domain SavedCart entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('saved_carts')
@Index('idx_saved_carts_customer_id', ['customerId'])
@Index('idx_saved_carts_created_at', ['createdAt'])
export class SavedCartEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  customerId!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('jsonb')
  items!: Record<string, unknown>;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column('timestamp with time zone', { nullable: true })
  expiresAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
