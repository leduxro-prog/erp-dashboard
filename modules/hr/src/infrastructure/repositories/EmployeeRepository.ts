import { Repository, DataSource, FindOptionsWhere, ILike, In } from 'typeorm';
import { EmployeeEntity } from '../entities/Employee';
import { EmployeeListQueryDTO } from '../../application/dtos/EmployeeDTO';

export class EmployeeRepository {
    private repository: Repository<EmployeeEntity>;

    constructor(dataSource: DataSource) {
        this.repository = dataSource.getRepository(EmployeeEntity);
    }

    async create(employee: Partial<EmployeeEntity>): Promise<EmployeeEntity> {
        const newEmployee = this.repository.create(employee);
        return await this.repository.save(newEmployee);
    }

    async findById(id: string): Promise<EmployeeEntity | null> {
        return await this.repository.findOne({
            where: { id, isDeleted: false },
        });
    }

    async findByEmail(email: string): Promise<EmployeeEntity | null> {
        return await this.repository.findOne({
            where: { email, isDeleted: false },
        });
    }

    async findByCode(code: string): Promise<EmployeeEntity | null> {
        return await this.repository.findOne({
            where: { code, isDeleted: false },
        });
    }

    async findByUserId(userId: string): Promise<EmployeeEntity | null> {
        return await this.repository.findOne({
            where: { userId, isDeleted: false },
        });
    }

    async findByDepartment(departmentId: string): Promise<EmployeeEntity[]> {
        return await this.repository.find({
            where: { departmentId, isDeleted: false },
        });
    }

    async findByManager(managerId: string): Promise<EmployeeEntity[]> {
        return await this.repository.find({
            where: { managerId, isDeleted: false },
        });
    }

    async findList(query: EmployeeListQueryDTO): Promise<[EmployeeEntity[], number]> {
        const qb = this.repository.createQueryBuilder('e').where('e.isDeleted = false');

        if (query.search) {
            qb.andWhere(
                `(e.firstName ILIKE :search OR e.lastName ILIKE :search OR e.email ILIKE :search OR e.code ILIKE :search)`,
                { search: `%${query.search}%` }
            );
        }

        if (query.departmentId) {
            qb.andWhere('e.departmentId = :departmentId', { departmentId: query.departmentId });
        }

        if (query.status) {
            qb.andWhere('e.status = :status', { status: query.status });
        }

        if (query.employmentStatus) {
            qb.andWhere('e.employmentStatus = :employmentStatus', {
                employmentStatus: query.employmentStatus,
            });
        }

        if (query.managerId) {
            qb.andWhere('e.managerId = :managerId', { managerId: query.managerId });
        }

        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`e.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async update(id: string, employee: Partial<EmployeeEntity>): Promise<EmployeeEntity | null> {
        await this.repository.update(id, employee);
        return await this.findById(id);
    }

    async softDelete(id: string): Promise<void> {
        await this.repository.update(id, { isDeleted: true, status: 'inactive' });
    }

    async findActiveEmployees(): Promise<EmployeeEntity[]> {
        return await this.repository.find({
            where: {
                employmentStatus: In(['active', 'probation', 'contract']),
                isDeleted: false,
            },
        });
    }

    async findTerminatedEmployees(): Promise<EmployeeEntity[]> {
        return await this.repository.find({
            where: {
                employmentStatus: In(['terminated', 'resigned']),
                isDeleted: false,
            },
        });
    }

    async countByDepartment(departmentId: string): Promise<number> {
        return await this.repository.count({
            where: { departmentId, isDeleted: false },
        });
    }
}
