import { DepartmentRepository } from '../../infrastructure/repositories/DepartmentRepository';
import { DepartmentEntity } from '../../infrastructure/entities/Department';
import { CreateDepartmentDTO, UpdateDepartmentDTO, DepartmentListQueryDTO } from '../../application/dtos/DepartmentDTO';

export class DepartmentService {
    constructor(private departmentRepository: DepartmentRepository) {}

    async createDepartment(dto: CreateDepartmentDTO, createdBy: string): Promise<DepartmentEntity> {
        const existing = await this.departmentRepository.findByCode(dto.code);
        if (existing) {
            throw new Error(`Department with code ${dto.code} already exists`);
        }

        if (dto.parentDepartmentId) {
            const parent = await this.departmentRepository.findById(dto.parentDepartmentId);
            if (!parent) {
                throw new Error(`Parent department ${dto.parentDepartmentId} not found`);
            }
        }

        return await this.departmentRepository.create({
            ...dto,
            status: 'active',
            createdBy,
        });
    }

    async getDepartment(id: string): Promise<DepartmentEntity> {
        const department = await this.departmentRepository.findById(id);
        if (!department) {
            throw new Error(`Department ${id} not found`);
        }
        return department;
    }

    async updateDepartment(id: string, dto: UpdateDepartmentDTO, updatedBy: string): Promise<DepartmentEntity> {
        await this.getDepartment(id);

        if (dto.code) {
            const existing = await this.departmentRepository.findByCode(dto.code);
            if (existing && existing.id !== id) {
                throw new Error(`Department with code ${dto.code} already exists`);
            }
        }

        if (dto.parentDepartmentId) {
            if (dto.parentDepartmentId === id) {
                throw new Error('Department cannot be its own parent');
            }
            const parent = await this.departmentRepository.findById(dto.parentDepartmentId);
            if (!parent) {
                throw new Error(`Parent department ${dto.parentDepartmentId} not found`);
            }
        }

        return (await this.departmentRepository.update(id, {
            ...dto,
            updatedBy,
        }))!;
    }

    async deleteDepartment(id: string): Promise<void> {
        const department = await this.getDepartment(id);
        const children = await this.departmentRepository.findChildren(id);

        if (children.length > 0) {
            throw new Error('Cannot delete department with child departments');
        }

        await this.departmentRepository.delete(id);
    }

    async listDepartments(query: DepartmentListQueryDTO): Promise<{ data: DepartmentEntity[]; total: number }> {
        const [departments, total] = await this.departmentRepository.findList(query);
        return { data: departments, total };
    }

    async getAllDepartments(): Promise<DepartmentEntity[]> {
        return await this.departmentRepository.findAll();
    }

    async getDepartmentHierarchy(): Promise<DepartmentEntity[]> {
        return await this.departmentRepository.getHierarchy();
    }

    async getChildDepartments(parentId: string): Promise<DepartmentEntity[]> {
        await this.getDepartment(parentId);
        return await this.departmentRepository.findChildren(parentId);
    }

    async updateDepartmentHeadcount(id: string, headcount: number): Promise<void> {
        await this.getDepartment(id);
        await this.departmentRepository.updateHeadcount(id, headcount);
    }
}
