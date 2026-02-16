import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('workflow_templates')
@Index(['entityType', 'version'])
@Index(['entityType', 'isActive'])
@Index(['isActive'])
export class WorkflowTemplateEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { length: 255 })
  name!: string;

  @Column('text')
  description!: string;

  @Column('varchar', { length: 100 })
  entityType!: string;

  @Column('int')
  version!: number;

  @Column('json')
  steps!: any[]; // Serialized IWorkflowStep[]

  @Column('boolean', { default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
