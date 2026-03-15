import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { ProductEntity } from '../../../../catalog/src/infrastructure/entities/ProductEntity';
import { B2BProjectEntity } from './B2BProjectEntity';

@Entity('b2b_project_items')
export class B2BProjectItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'project_id' })
  project_id!: string;

  @ManyToOne(() => B2BProjectEntity)
  @JoinColumn({ name: 'project_id' })
  project!: B2BProjectEntity;

  @Column('integer', { name: 'product_id' })
  product_id!: number;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column('integer', { name: 'quantity', default: 1 })
  quantity!: number;

  @Column('text', { name: 'notes', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
