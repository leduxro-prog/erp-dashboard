import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';

@Entity('departments')
@Index(['code'])
@Index(['parentDepartmentId'])
export class DepartmentEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string;

    @Column({ type: 'uuid', nullable: true })
    parentDepartmentId!: string | null;

    @ManyToOne(() => DepartmentEntity, (dept) => dept.childDepartments, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'parentDepartmentId' })
    parentDepartment!: DepartmentEntity | null;

    @OneToMany(() => DepartmentEntity, (dept) => dept.parentDepartment)
    childDepartments!: DepartmentEntity[];

    @Column({ type: 'uuid', nullable: true })
    headId!: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    costCenter!: string;

    @Column({ type: 'integer', default: 0 })
    headcount!: number;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'archived';

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
