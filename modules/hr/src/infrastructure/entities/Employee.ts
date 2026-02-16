import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';

@Entity('employees')
@Index(['code'])
@Index(['email'])
@Index(['departmentId'])
@Index(['positionId'])
@Index(['status'])
export class EmployeeEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    code!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar', length: 100 })
    firstName!: string;

    @Column({ type: 'varchar', length: 100 })
    lastName!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone!: string;

    @Column({ type: 'date' })
    dateOfBirth!: Date;

    @Column({ type: 'varchar', length: 50 })
    gender!: 'male' | 'female' | 'other';

    @Column({ type: 'varchar', length: 20, nullable: true })
    nationalIdNumber!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    passportNumber!: string;

    @Column({ type: 'text', nullable: true })
    address!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    county!: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    postalCode!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    country!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    emergencyContactPhone!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    emergencyContactName!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    emergencyContactRelation!: string;

    @Column({ type: 'uuid' })
    departmentId!: string;

    @Column({ type: 'uuid' })
    positionId!: string;

    @Column({ type: 'uuid', nullable: true })
    managerId!: string | null;

    @ManyToOne(() => EmployeeEntity, (emp) => emp.subordinates, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'managerId' })
    manager!: EmployeeEntity | null;

    @OneToMany(() => EmployeeEntity, (emp) => emp.manager)
    subordinates!: EmployeeEntity[];

    @Column({ type: 'date' })
    hireDate!: Date;

    @Column({ type: 'date', nullable: true })
    terminationDate!: Date;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    employmentStatus!: 'active' | 'probation' | 'contract' | 'suspended' | 'terminated' | 'resigned';

    @Column({ type: 'varchar', length: 50 })
    employmentType!: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'intern';

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    baseSalary!: number;

    @Column({ type: 'varchar', length: 50, default: 'monthly' })
    salaryFrequency!: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 40 })
    hoursPerWeek!: number;

    @Column({ type: 'varchar', length: 20, nullable: true })
    bankAccountNumber!: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    bankName!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    bankCode!: string;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'archived';

    @Column({ type: 'boolean', default: false })
    isDeleted!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    createdBy!: string;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
