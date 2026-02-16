import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('workflow_instances')
@Index(['entityType', 'entityId'])
@Index(['templateId'])
@Index(['status'])
@Index(['currentStepId'])
@Index(['createdAt'])
export class WorkflowInstanceEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  templateId!: string;

  @Column('varchar', { length: 100 })
  entityType!: string;

  @Column('varchar', { length: 100 })
  entityId!: string;

  @Column('varchar', {
    length: 50,
    enum: ['pending', 'in_progress', 'approved', 'rejected', 'cancelled', 'escalated'],
  } as any)
  status!: string;

  @Column('varchar')
  currentStepId!: string;

  @Column('json')
  steps!: any[]; // Serialized IWorkflowInstanceStep[]

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @Column('varchar', { nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column('timestamp', { nullable: true })
  completedAt?: Date;
}
