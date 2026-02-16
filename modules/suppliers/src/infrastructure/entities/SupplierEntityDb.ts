import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('suppliers')
@Index(['code'], { unique: true })
@Index(['isActive'])
export class SupplierEntityDb {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  website!: string;

  @Column({ type: 'varchar', length: 255 })
  contactEmail!: string;

  @Column({ type: 'varchar', length: 20 })
  contactPhone!: string;

  @Column({ type: 'varchar', length: 20 })
  whatsappNumber!: string;

  @Column({ type: 'int', default: 0 })
  productCount!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'json' })
  credentials!: {
    username: string;
    password: string;
    apiKey?: string;
    customHeader?: Record<string, string>;
  };

  @Column({ type: 'int', default: 4 })
  syncFrequency!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSync!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
