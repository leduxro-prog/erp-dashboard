import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';

import { ProductSpecificationEntity } from './ProductSpecificationEntity';

@Entity('products')
@Index(['sku'], { unique: true })
@Index(['category_id'])
@Index(['is_active'])
export class ProductEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('varchar', { length: 50, unique: true })
  sku!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('varchar', { length: 500, nullable: true })
  short_description!: string | null;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  base_price!: number;

  @Column('varchar', { length: 3, default: 'RON' })
  currency_code!: string;

  @Column('varchar', { length: 20, default: 'buc' })
  unit_of_measure!: string;

  @Column('integer', { default: 1 })
  min_order_quantity!: number;

  @Column('integer', { default: 0 })
  lead_time_days!: number;

  @Column('integer', { nullable: true })
  category_id!: number | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @OneToOne(() => ProductSpecificationEntity, (specs) => specs.product, { cascade: true })
  specs!: ProductSpecificationEntity;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deleted_at!: Date | null;
}
