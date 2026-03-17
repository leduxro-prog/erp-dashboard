import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('purchase_requisitions')
@Index('idx_req_department_status', ['departmentId', 'status'])
@Index('idx_req_number_unique', ['requisitionNumber'], { unique: true })
export class PurchaseRequisitionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 64 })
  requisitionNumber!: string;

  @Column('varchar', { length: 64 })
  departmentId!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('varchar', { length: 32 })
  priority!: string;

  @Column('text')
  title!: string;

  @Column('timestamptz', { nullable: true })
  requiredBy!: Date | null;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
