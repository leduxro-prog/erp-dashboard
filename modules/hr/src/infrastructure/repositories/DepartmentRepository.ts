import { Repository, DataSource, TreeRepository, IsNull } from 'typeorm';
import { DepartmentEntity } from '../entities/Department';
import { DepartmentListQueryDTO } from '../../application/dtos/DepartmentDTO';

export class DepartmentRepository {
    private repository: Repository<DepartmentEntity>;

    constructor(dataSource: DataSource) {
        this.repository = dataSource.getRepository(DepartmentEntity);
    }

    async create(department: Partial<DepartmentEntity>): Promise<DepartmentEntity> {
        const newDepartment = this.repository.create(department);
        return await this.repository.save(newDepartment);
    }

    async findById(id: string): Promise<DepartmentEntity | null> {
        return await this.repository.findOne({
            where: { id, status: 'active' },
            relations: ['parentDepartment', 'childDepartments'],
        });
    }

    async findByCode(code: string): Promise<DepartmentEntity | null> {
        return await this.repository.findOne({
            where: { code, status: 'active' },
        });
    }

    async findAll(): Promise<DepartmentEntity[]> {
        return await this.repository.find({
            where: { status: 'active' },
            order: { name: 'ASC' },
        });
    }

    async findList(query: DepartmentListQueryDTO): Promise<[DepartmentEntity[], number]> {
        const qb = this.repository
            .createQueryBuilder('d')
            .where('d.status = :status', { status: 'active' })
            .leftJoinAndSelect('d.parentDepartment', 'parent')
            .leftJoinAndSelect('d.childDepartments', 'children');

        if (query.search) {
            qb.andWhere(
                `(d.name ILIKE :search OR d.code ILIKE :search OR d.description ILIKE :search)`,
                { search: `%${query.search}%` }
            );
        }

        if (query.parentDepartmentId) {
            qb.andWhere('d.parentDepartmentId = :parentDepartmentId', {
                parentDepartmentId: query.parentDepartmentId,
            });
        }

        const sortBy = query.sortBy || 'name';
        const sortOrder = query.sortOrder || 'ASC';
        qb.orderBy(`d.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async update(id: string, department: Partial<DepartmentEntity>): Promise<DepartmentEntity | null> {
        await this.repository.update(id, department);
        return await this.findById(id);
    }

    async delete(id: string): Promise<void> {
        await this.repository.update(id, { status: 'archived' });
    }

    async getHierarchy(): Promise<DepartmentEntity[]> {
        return await this.repository.find({
            where: { parentDepartmentId: IsNull(), status: 'active' },
            relations: ['childDepartments'],
        });
    }

    async findChildren(parentId: string): Promise<DepartmentEntity[]> {
        return await this.repository.find({
            where: { parentDepartmentId: parentId, status: 'active' },
        });
    }

    async updateHeadcount(id: string, headcount: number): Promise<void> {
        await this.repository.update(id, { headcount });
    }
}
