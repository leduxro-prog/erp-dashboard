import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('employee_documents')
@Index(['employeeId'])
@Index(['documentType'])
export class EmployeeDocumentEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    employeeId!: string;

    @Column({ type: 'varchar', length: 100 })
    documentType!: string;

    @Column({ type: 'varchar', length: 255 })
    fileName!: string;

    @Column({ type: 'varchar', length: 500 })
    filePath!: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    fileExtension!: string;

    @Column({ type: 'bigint', nullable: true })
    fileSize!: number;

    @Column({ type: 'date', nullable: true })
    issueDate!: Date;

    @Column({ type: 'date', nullable: true })
    expiryDate!: Date;

    @Column({ type: 'text', nullable: true })
    remarks!: string;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status!: 'active' | 'inactive' | 'expired' | 'archived';

    @CreateDateColumn()
    uploadedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    uploadedBy!: string;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'uuid', nullable: true })
    updatedBy!: string;
}
