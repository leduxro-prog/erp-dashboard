/**
 * CompatibilityRule TypeORM Entity
 * Maps domain CompatibilityRule entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('compatibility_rules')
@Index('idx_compatibility_rules_component1_id', ['component1Id'])
@Index('idx_compatibility_rules_component2_id', ['component2Id'])
@Index('idx_compatibility_rules_created_at', ['createdAt'])
export class CompatibilityRuleEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  component1Id!: string;

  @Column('varchar', { length: 255 })
  component2Id!: string;

  @Column({
    type: 'enum',
    enum: ['COMPATIBLE', 'INCOMPATIBLE', 'CONDITIONAL'],
  })
  compatibility!: string;

  @Column('text', { nullable: true })
  rule?: string;

  @Column('jsonb', { nullable: true, default: {} })
  conditions?: Record<string, unknown>;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
