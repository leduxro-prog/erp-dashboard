/**
 * NotificationTemplate TypeORM Entity
 * Maps domain NotificationTemplate entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_templates')
@Index('idx_notification_templates_slug', ['slug', 'locale'], { unique: true })
@Index('idx_notification_templates_channel', ['channel'])
@Index('idx_notification_templates_is_active', ['isActive'])
@Index('idx_notification_templates_created_at', ['createdAt'])
export class NotificationTemplateEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 255 })
  slug!: string;

  @Column({
    type: 'enum',
    enum: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'],
  })
  channel!: string;

  @Column('text')
  subject!: string;

  @Column('text')
  body!: string;

  @Column('varchar', { length: 5 })
  locale!: string; // 'ro' or 'en'

  @Column('boolean', { default: true })
  isActive!: boolean;

  @Column('int', { default: 1 })
  version!: number;

  @Column('uuid')
  createdBy!: string;

  @Column('int', { default: 0 })
  usageCount!: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
