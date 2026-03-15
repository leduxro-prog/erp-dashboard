import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('product_specifications')
export class ProductSpecificationEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('integer', { name: 'product_id' })
  product_id!: number;

  @Column('varchar', { name: 'ies_file_url', length: 500, nullable: true })
  ies_file_url!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
