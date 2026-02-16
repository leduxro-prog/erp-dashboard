import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * TypeORM entity for WhatsApp Agent.
 *
 * Represents support agent data in database.
 */
@Entity('whatsapp_agents')
export class WhatsAppAgentEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({
    type: 'enum',
    enum: ['online', 'away', 'offline'],
    default: 'online',
  })
  status!: 'online' | 'away' | 'offline';

  @Column({ type: 'int', default: 0 })
  activeConversations!: number;

  @Column({ type: 'int', default: 0 })
  assignedConversations!: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastStatusUpdate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
