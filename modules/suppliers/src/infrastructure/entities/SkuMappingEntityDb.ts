import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupplierEntityDb } from './SupplierEntityDb';

@Entity('sku_mappings')
@Index(['supplierId', 'supplierSku'], { unique: true })
@Index(['supplierId'])
@Index(['internalProductId'])
export class SkuMappingEntityDb {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  supplierId!: number;

  @ManyToOne(() => SupplierEntityDb, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier!: SupplierEntityDb;

  @Column({ type: 'varchar', length: 100 })
  supplierSku!: string;

  @Column({ type: 'int' })
  internalProductId!: number;

  @Column({ type: 'varchar', length: 100 })
  internalSku!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
