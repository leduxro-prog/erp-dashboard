/**
 * StructuredData TypeORM Entity
 * Maps domain StructuredData entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('structured_data')
@Index('idx_structured_data_entity_type_id', ['entityType', 'entityId'])
@Index('idx_structured_data_schema_type', ['schemaType'])
@Index('idx_structured_data_created_at', ['createdAt'])
export class StructuredDataEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 50 })
  entityType!: string;

  @Column('varchar', { length: 255 })
  entityId!: string;

  @Column('varchar', { length: 100 })
  schemaType!: string;

  @Column('jsonb')
  schema!: Record<string, unknown>;

  @Column('varchar', { length: 50, nullable: true })
  locale?: string;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('int', { default: 0 })
  validationScore!: number;

  @Column('jsonb', { nullable: true, default: {} })
  validationErrors?: Record<string, unknown>;

  @Column('timestamp with time zone', { nullable: true })
  lastValidatedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
