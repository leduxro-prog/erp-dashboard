import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('warehouses')
@Index(['code'], { unique: true })
@Index(['smartbill_id'])
export class WarehouseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('varchar', { length: 50 })
  code!: string;

  @Column('integer', { default: 999 })
  priority!: number;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @Column('varchar', { length: 100, nullable: true })
  city!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  region!: string | null;

  @Column('varchar', { length: 20, nullable: true, name: 'postal_code' })
  postal_code!: string | null;

  @Column('varchar', { nullable: true, name: 'smartbill_id' })
  smartbill_id!: string;

  @CreateDateColumn()
  created_at!: Date;
}
