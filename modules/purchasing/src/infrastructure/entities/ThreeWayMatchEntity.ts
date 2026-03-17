import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('three_way_matches')
@Index('idx_match_invoice', ['invoiceId'])
@Index('idx_match_status', ['status'])
export class ThreeWayMatchEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 64 })
  poId!: string;

  @Column('varchar', { length: 64 })
  grnId!: string;

  @Column('varchar', { length: 64 })
  invoiceId!: string;

  @Column('varchar', { length: 32 })
  status!: string;

  @Column('timestamptz', { nullable: true })
  matchedAt!: Date | null;

  @Column('jsonb', { default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
