import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM entity for WhatsApp Tag.
 *
 * Represents tag data in database.
 */
@Entity('whatsapp_tags')
export class WhatsAppTagEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 7 })
  color!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
