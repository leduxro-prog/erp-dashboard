/**
 * SeoMetadata TypeORM Entity
 * Maps domain SeoMetadata entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('seo_metadata')
@Index('idx_seo_metadata_entity_type_id', ['entityType', 'entityId'])
@Index('idx_seo_metadata_slug', ['slug'])
@Index('idx_seo_metadata_locale', ['locale'])
@Index('idx_seo_metadata_seo_score', ['seoScore'])
@Index('idx_seo_metadata_created_at', ['createdAt'])
export class SeoMetadataEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 50 })
  entityType!: string;

  @Column('varchar', { length: 255 })
  entityId!: string;

  @Column({
    type: 'enum',
    enum: ['ro', 'en'],
  })
  locale!: string;

  @Column('varchar', { length: 60 })
  metaTitle!: string;

  @Column('varchar', { length: 160 })
  metaDescription!: string;

  @Column('varchar', { length: 255 })
  slug!: string;

  @Column('varchar', { length: 512, nullable: true })
  canonicalUrl?: string;

  @Column('varchar', { length: 255, nullable: true })
  ogTitle?: string;

  @Column('varchar', { length: 255, nullable: true })
  ogDescription?: string;

  @Column('varchar', { length: 512, nullable: true })
  ogImage?: string;

  @Column('varchar', { length: 255, nullable: true })
  twitterTitle?: string;

  @Column('varchar', { length: 255, nullable: true })
  twitterDescription?: string;

  @Column('varchar', { length: 255, nullable: true })
  focusKeyword?: string;

  @Column('text', { array: true, default: [] })
  secondaryKeywords!: string[];

  @Column('int', { default: 0 })
  seoScore!: number;

  @Column('jsonb', { default: [] })
  issues!: Record<string, unknown>;

  @Column('timestamp with time zone', { nullable: true })
  lastAuditedAt?: Date;

  @Column('timestamp with time zone', { nullable: true })
  lastPublishedAt?: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
