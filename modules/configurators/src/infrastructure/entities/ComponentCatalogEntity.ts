/**
 * ComponentCatalog TypeORM Entity
 * Maps domain ComponentCatalog entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('component_catalogs')
@Index('idx_component_catalogs_type', ['type'])
@Index('idx_component_catalogs_created_at', ['createdAt'])
export class ComponentCatalogEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  type!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text')
  description!: string;

  @Column('varchar', { length: 255, nullable: true })
  category?: string;

  @Column('jsonb', { nullable: true, default: {} })
  properties?: Record<string, unknown>;

  @Column('varchar', { length: 255, nullable: true })
  imageUrl?: string;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
