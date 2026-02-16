import { EmployeeRepository } from '../../infrastructure/repositories/EmployeeRepository';
import { EmployeeEntity } from '../../infrastructure/entities/Employee';
import { CreateEmployeeDTO, UpdateEmployeeDTO, TerminateEmployeeDTO, EmployeeListQueryDTO } from '../../application/dtos/EmployeeDTO';

export class EmployeeService {
    constructor(private employeeRepository: EmployeeRepository) { }

    async createEmployee(dto: CreateEmployeeDTO, createdBy: string): Promise<EmployeeEntity> {
        const existing = await this.employeeRepository.findByCode(dto.code);
        if (existing) {
            throw new Error(`Employee with code ${dto.code} already exists`);
        }

        const emailExists = await this.employeeRepository.findByEmail(dto.email);
        if (emailExists) {
            throw new Error(`Employee with email ${dto.email} already exists`);
        }

        return await this.employeeRepository.create({
            ...dto,
            status: 'active',
            employmentStatus: 'active',
            createdBy,
        } as unknown as Partial<EmployeeEntity>);
    }

    async getEmployee(id: string): Promise<EmployeeEntity> {
        const employee = await this.employeeRepository.findById(id);
        if (!employee) {
            throw new Error(`Employee ${id} not found`);
        }
        return employee;
    }

    async updateEmployee(id: string, dto: UpdateEmployeeDTO, updatedBy: string): Promise<EmployeeEntity> {
        const employee = await this.getEmployee(id);

        if (dto.email && dto.email !== employee.email) {
            const emailExists = await this.employeeRepository.findByEmail(dto.email);
            if (emailExists) {
                throw new Error(`Email ${dto.email} already in use`);
            }
        }

        return (await this.employeeRepository.update(id, {
            ...dto,
            updatedBy,
        } as unknown as Partial<EmployeeEntity>))!;
    }

    async terminateEmployee(id: string, dto: TerminateEmployeeDTO, updatedBy: string): Promise<EmployeeEntity> {
        const employee = await this.getEmployee(id);

        return (await this.employeeRepository.update(id, {
            terminationDate: new Date(dto.terminationDate),
            employmentStatus: 'terminated',
            status: 'inactive',
            updatedBy,
        }))!;
    }

    async deleteEmployee(id: string): Promise<void> {
        await this.getEmployee(id);
        await this.employeeRepository.softDelete(id);
    }

    async listEmployees(query: EmployeeListQueryDTO): Promise<{ data: EmployeeEntity[]; total: number }> {
        const [employees, total] = await this.employeeRepository.findList(query);
        return { data: employees, total };
    }

    async getEmployeeByEmail(email: string): Promise<EmployeeEntity> {
        const employee = await this.employeeRepository.findByEmail(email);
        if (!employee) {
            throw new Error(`Employee with email ${email} not found`);
        }
        return employee;
    }

    async getEmployeesByDepartment(departmentId: string): Promise<EmployeeEntity[]> {
        return await this.employeeRepository.findByDepartment(departmentId);
    }

    async getEmployeesByManager(managerId: string): Promise<EmployeeEntity[]> {
        return await this.employeeRepository.findByManager(managerId);
    }

    async getActiveEmployees(): Promise<EmployeeEntity[]> {
        return await this.employeeRepository.findActiveEmployees();
    }

    async getTerminatedEmployees(): Promise<EmployeeEntity[]> {
        return await this.employeeRepository.findTerminatedEmployees();
    }

    async getDepartmentHeadcount(departmentId: string): Promise<number> {
        return await this.employeeRepository.countByDepartment(departmentId);
    }
}
