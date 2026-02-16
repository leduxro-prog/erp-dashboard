import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('volume_discount_rules')
export class VolumeDiscountRuleEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column('integer')
  product_id!: number;

  @Column('integer', { nullable: true })
  min_quantity!: number | null;

  @Column('integer', { nullable: true })
  max_quantity!: number | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  min_total_value!: number | null;

  @Column('decimal', { precision: 5, scale: 2 })
  discount_percentage!: number;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
