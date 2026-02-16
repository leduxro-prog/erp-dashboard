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

@Entity('supplier_products')
@Index(['supplierId', 'supplierSku'], { unique: true })
@Index(['supplierId'])
@Index(['lastScraped'])
export class SupplierProductEntityDb {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  supplierId!: number;

  @ManyToOne(() => SupplierEntityDb, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierId' })
  supplier!: SupplierEntityDb;

  @Column({ type: 'varchar', length: 100 })
  supplierSku!: string;

  @Column({ type: 'varchar', length: 500 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency!: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity!: number;

  @Column({ type: 'timestamp' })
  lastScraped!: Date;

  @Column({ type: 'json', nullable: true })
  priceHistory!: Array<{
    price: number;
    date: Date;
  }>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
