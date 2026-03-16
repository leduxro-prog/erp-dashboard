import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { ProductEntity } from './ProductEntity';

@Entity('product_specifications')
export class ProductSpecificationEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('integer', { name: 'product_id' })
  @Index({ unique: true })
  product_id!: number;

  @OneToOne(() => ProductEntity, (product) => product.specs)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  wattage!: number | null;

  @Column('integer', { nullable: true })
  lumens!: number | null;

  @Column('integer', { nullable: true })
  color_temperature!: number | null;

  @Column('integer', { nullable: true })
  cri!: number | null;

  @Column('varchar', { length: 50, nullable: true })
  beam_angle!: string | null;

  @Column('varchar', { length: 20, nullable: true })
  ip_rating!: string | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  efficacy!: number | null;

  @Column('boolean', { default: false })
  dimmable!: boolean;

  @Column('varchar', { length: 50, nullable: true })
  dimming_type!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  voltage_input!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  mounting_type!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  material!: string | null;

  @Column('varchar', { length: 50, nullable: true })
  color!: string | null;

  @Column('integer', { nullable: true })
  lifespan_hours!: number | null;

  @Column('integer', { nullable: true })
  warranty_years!: number | null;

  @Column('boolean', { default: true })
  certification_ce!: boolean;

  @Column('boolean', { default: true })
  certification_rohs!: boolean;

  @Column('varchar', { length: 10, nullable: true })
  energy_class!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  brand!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  manufacturer!: string | null;

  @Column('varchar', { length: 100, nullable: true })
  country_of_origin!: string | null;

  @Column('varchar', { name: 'ies_file_url', length: 500, nullable: true })
  ies_file_url!: string | null;

  @Column('varchar', { length: 500, nullable: true })
  datasheet_url!: string | null;

  @Column('varchar', { length: 500, nullable: true })
  installation_guide_url!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
