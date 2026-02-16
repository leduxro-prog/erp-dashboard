/**
 * NotificationPreference TypeORM Entity
 * Maps domain NotificationPreference entity to database table
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_preferences')
@Index('idx_notification_preferences_customer_id', ['customerId'])
@Index('idx_notification_preferences_customer_channel', ['customerId', 'channel'], {
  unique: true,
})
@Index('idx_notification_preferences_channel', ['channel'])
@Index('idx_notification_preferences_is_enabled', ['isEnabled'])
export class NotificationPreferenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  customerId!: string;

  @Column({
    type: 'enum',
    enum: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'],
  })
  channel!: string;

  @Column('boolean', { default: true })
  isEnabled!: boolean;

  @Column('varchar', { length: 5, nullable: true })
  quietHoursStart?: string; // HH:mm format

  @Column('varchar', { length: 5, nullable: true })
  quietHoursEnd?: string; // HH:mm format

  @Column({
    type: 'enum',
    enum: ['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST'],
    default: 'IMMEDIATE',
  })
  frequency!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
