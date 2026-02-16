/**
 * Sitemap TypeORM Entity
 * Maps domain Sitemap entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('sitemaps')
@Index('idx_sitemaps_type', ['type'])
@Index('idx_sitemaps_last_generated_at', ['lastGeneratedAt'])
@Index('idx_sitemaps_created_at', ['createdAt'])
export class SitemapEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ['PRODUCT', 'CATEGORY', 'PAGE'],
  })
  type!: string;

  @Column('varchar', { length: 512 })
  url!: string;

  @Column('int')
  urlCount!: number;

  @Column('text')
  content!: string;

  @Column('varchar', { length: 50, nullable: true })
  locale?: string;

  @Column('boolean', { default: false })
  isPublished!: boolean;

  @Column('timestamp with time zone', { nullable: true })
  publishedAt?: Date;

  @Column('timestamp with time zone')
  lastGeneratedAt!: Date;

  @Column('jsonb', { nullable: true, default: {} })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
