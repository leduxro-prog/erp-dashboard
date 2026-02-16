import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class ProductPriceEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('varchar', { length: 100 })
  sku!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  base_price!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  cost!: number;

  @Column('decimal', { precision: 5, scale: 2 })
  margin_percentage!: number;

  @Column('integer', { nullable: true })
  category_id!: number | null;

  @Column('varchar', { length: 255, nullable: true })
  name!: string;

  @Column('text', { nullable: true })
  description!: string;

  @Column('varchar', { length: 500, nullable: true })
  image_url!: string;

  @Column('integer', { default: 0 })
  smartbill_stock!: number;

  @Column('integer', { default: 0 })
  supplier_stock!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
