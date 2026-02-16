import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('promotions')
export class PromotionEntity {
  @PrimaryColumn('integer')
  id!: number;

  @Column('integer')
  product_id!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  promotional_price!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  original_price!: number;

  @Column('timestamp')
  valid_from!: Date;

  @Column('timestamp')
  valid_until!: Date;

  @Column('varchar', { length: 255, nullable: true })
  reason!: string | null;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
