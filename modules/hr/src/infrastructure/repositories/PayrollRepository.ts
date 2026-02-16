import { Repository, DataSource } from 'typeorm';
import { PayrollRunEntity } from '../entities/PayrollRun';
import { PayrollEntryEntity } from '../entities/PayrollEntry';
import { PayslipEntity } from '../entities/Payslip';
import { PayrollListQueryDTO } from '../../application/dtos/PayrollDTO';

export class PayrollRepository {
    private payrollRunRepository: Repository<PayrollRunEntity>;
    private payrollEntryRepository: Repository<PayrollEntryEntity>;
    private payslipRepository: Repository<PayslipEntity>;

    constructor(dataSource: DataSource) {
        this.payrollRunRepository = dataSource.getRepository(PayrollRunEntity);
        this.payrollEntryRepository = dataSource.getRepository(PayrollEntryEntity);
        this.payslipRepository = dataSource.getRepository(PayslipEntity);
    }

    async createPayrollRun(run: Partial<PayrollRunEntity>): Promise<PayrollRunEntity> {
        const newRun = this.payrollRunRepository.create(run);
        return await this.payrollRunRepository.save(newRun);
    }

    async findPayrollRunById(id: string): Promise<PayrollRunEntity | null> {
        return await this.payrollRunRepository.findOne({
            where: { id },
        });
    }

    async findPayrollRuns(query: PayrollListQueryDTO): Promise<[PayrollRunEntity[], number]> {
        const qb = this.payrollRunRepository.createQueryBuilder('pr');

        if (query.month) {
            qb.andWhere('pr.month = :month', { month: query.month });
        }

        if (query.year) {
            qb.andWhere('pr.year = :year', { year: query.year });
        }

        if (query.status) {
            qb.andWhere('pr.status = :status', { status: query.status });
        }

        const sortBy = query.sortBy || 'startDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`pr.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async updatePayrollRun(id: string, run: Partial<PayrollRunEntity>): Promise<PayrollRunEntity | null> {
        await this.payrollRunRepository.update(id, run);
        return await this.findPayrollRunById(id);
    }

    async createPayrollEntry(entry: Partial<PayrollEntryEntity>): Promise<PayrollEntryEntity> {
        const newEntry = this.payrollEntryRepository.create(entry);
        return await this.payrollEntryRepository.save(newEntry);
    }

    async findPayrollEntriesByRun(payrollRunId: string): Promise<PayrollEntryEntity[]> {
        return await this.payrollEntryRepository.find({
            where: { payrollRunId },
        });
    }

    async findPayrollEntryById(id: string): Promise<PayrollEntryEntity | null> {
        return await this.payrollEntryRepository.findOne({
            where: { id },
        });
    }

    async updatePayrollEntry(id: string, entry: Partial<PayrollEntryEntity>): Promise<PayrollEntryEntity | null> {
        await this.payrollEntryRepository.update(id, entry);
        return await this.findPayrollEntryById(id);
    }

    async bulkCreatePayrollEntries(entries: Partial<PayrollEntryEntity>[]): Promise<PayrollEntryEntity[]> {
        const newEntries = this.payrollEntryRepository.create(entries);
        return await this.payrollEntryRepository.save(newEntries);
    }

    async createPayslip(payslip: Partial<PayslipEntity>): Promise<PayslipEntity> {
        const newPayslip = this.payslipRepository.create(payslip);
        return await this.payslipRepository.save(newPayslip);
    }

    async findPayslipById(id: string): Promise<PayslipEntity | null> {
        return await this.payslipRepository.findOne({
            where: { id },
        });
    }

    async findPayslipsByRun(payrollRunId: string): Promise<PayslipEntity[]> {
        return await this.payslipRepository.find({
            where: { payrollRunId },
        });
    }

    async findPayslipsByEmployee(employeeId: string, year?: number): Promise<PayslipEntity[]> {
        const query: any = { employeeId };
        if (year) {
            query.year = year;
        }

        return await this.payslipRepository.find({
            where: query,
            order: { month: 'DESC' },
        });
    }

    async updatePayslip(id: string, payslip: Partial<PayslipEntity>): Promise<PayslipEntity | null> {
        await this.payslipRepository.update(id, payslip);
        return await this.findPayslipById(id);
    }

    async bulkCreatePayslips(payslips: Partial<PayslipEntity>[]): Promise<PayslipEntity[]> {
        const newPayslips = this.payslipRepository.create(payslips);
        return await this.payslipRepository.save(newPayslips);
    }
}
