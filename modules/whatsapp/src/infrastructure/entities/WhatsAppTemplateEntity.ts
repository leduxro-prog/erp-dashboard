/**
 * WhatsAppTemplate TypeORM Entity
 * Maps domain WhatsAppTemplate entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('whatsapp_templates')
@Index('idx_whatsapp_templates_name', ['name'])
@Index('idx_whatsapp_templates_status', ['status'])
@Index('idx_whatsapp_templates_created_at', ['createdAt'])
export class WhatsAppTemplateEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text')
  content!: string;

  @Column('varchar', { length: 50, nullable: true })
  category?: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
  })
  status!: string;

  @Column('varchar', { length: 255, nullable: true })
  externalTemplateId?: string;

  @Column('jsonb', { nullable: true, default: {} })
  parameters?: Record<string, unknown>;

  @Column('text', { nullable: true })
  rejectionReason?: string;

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('int', { default: 0 })
  usageCount!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
