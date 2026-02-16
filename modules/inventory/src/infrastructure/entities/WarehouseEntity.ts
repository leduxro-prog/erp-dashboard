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

  @Column('varchar', { nullable: true })
  smartbill_id!: string;

  @CreateDateColumn()
  created_at!: Date;
}
