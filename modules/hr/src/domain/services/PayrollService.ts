import { PayrollRepository } from '../../infrastructure/repositories/PayrollRepository';
import { PayrollRunEntity } from '../../infrastructure/entities/PayrollRun';
import { PayrollEntryEntity } from '../../infrastructure/entities/PayrollEntry';
import { PayslipEntity } from '../../infrastructure/entities/Payslip';
import { CreatePayrollRunDTO, UpdatePayrollRunDTO, ProcessPayrollDTO, ApprovePayrollDTO, PayrollListQueryDTO } from '../../application/dtos/PayrollDTO';

export class PayrollService {
    private readonly ROMANIAN_CAS_RATE = 0.25;
    private readonly ROMANIAN_CASS_RATE = 0.1;
    private readonly ROMANIAN_INCOME_TAX_RATE = 0.1;

    constructor(private payrollRepository: PayrollRepository) { }

    async createPayrollRun(dto: CreatePayrollRunDTO, createdBy: string): Promise<PayrollRunEntity> {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (startDate > endDate) {
            throw new Error('Start date must be before end date');
        }

        return await this.payrollRepository.createPayrollRun({
            ...dto,
            startDate,
            endDate,
            paymentDate: new Date(dto.paymentDate),
            code: this.generatePayrollCode(dto.month, dto.year),
            status: 'draft',
            totalEmployees: 0,
            createdBy,
        });
    }

    async getPayrollRun(id: string): Promise<PayrollRunEntity> {
        const run = await this.payrollRepository.findPayrollRunById(id);
        if (!run) {
            throw new Error(`Payroll run ${id} not found`);
        }
        return run;
    }

    async updatePayrollRun(id: string, dto: UpdatePayrollRunDTO, updatedBy: string): Promise<PayrollRunEntity> {
        await this.getPayrollRun(id);

        return (await this.payrollRepository.updatePayrollRun(id, {
            ...dto,
            updatedBy,
        } as Partial<PayrollRunEntity>))!;
    }

    async listPayrollRuns(query: PayrollListQueryDTO): Promise<{ data: PayrollRunEntity[]; total: number }> {
        const [runs, total] = await this.payrollRepository.findPayrollRuns(query);
        return { data: runs, total };
    }

    async createPayrollEntries(
        payrollRunId: string,
        employeeIds: string[],
        salaryStructures: Map<string, any>,
        createdBy: string
    ): Promise<PayrollEntryEntity[]> {
        const run = await this.getPayrollRun(payrollRunId);

        const entries: Partial<PayrollEntryEntity>[] = [];

        for (const employeeId of employeeIds) {
            const structure = salaryStructures.get(employeeId);

            if (!structure) {
                continue;
            }

            const baseSalary = structure.baseSalary || 0;
            const allowances = structure.allowances || [];
            const deductions = structure.deductions || [];

            const grossSalary = baseSalary + allowances.reduce((sum: number, a: any) => sum + a.amount, 0);
            const cas = grossSalary * this.ROMANIAN_CAS_RATE;
            const casss = grossSalary * this.ROMANIAN_CASS_RATE;
            const incomeTax = Math.max(0, (grossSalary - cas - casss) * this.ROMANIAN_INCOME_TAX_RATE);
            const totalTax = cas + casss + incomeTax;
            const totalDeductions = totalTax + deductions.reduce((sum: number, d: any) => sum + d.amount, 0);
            const netSalary = grossSalary - totalDeductions;

            entries.push({
                payrollRunId,
                employeeId,
                salaryStructureId: structure.id,
                baseSalary,
                allowances,
                deductions,
                grossSalary,
                cas,
                casss,
                incomeTax,
                totalTax,
                totalDeductions,
                netSalary,
                status: 'pending',
                createdBy,
            });
        }

        const created = await this.payrollRepository.bulkCreatePayrollEntries(entries);

        const totals = this.calculatePayrollTotals(created);
        await this.payrollRepository.updatePayrollRun(payrollRunId, {
            totalEmployees: created.length,
            totalGrossSalary: totals.grossSalary,
            totalNetSalary: totals.netSalary,
            totalTax: totals.tax,
            totalCAS: totals.cas,
            totalCASSS: totals.casss,
            totalDeductions: totals.deductions,
            updatedBy: createdBy,
        });

        return created;
    }

    async approvePayroll(id: string, dto: ApprovePayrollDTO, approvedBy: string): Promise<PayrollRunEntity> {
        const run = await this.getPayrollRun(id);

        if (run.status !== 'draft' && run.status !== 'submitted') {
            throw new Error(`Cannot approve payroll in ${run.status} status`);
        }

        const entries = await this.payrollRepository.findPayrollEntriesByRun(id);

        for (const entry of entries) {
            await this.payrollRepository.updatePayrollEntry(entry.id, {
                status: 'approved',
                approvedBy,
                approvedAt: new Date(),
                updatedBy: approvedBy,
            });
        }

        return (await this.payrollRepository.updatePayrollRun(id, {
            status: 'approved',
            approvedBy,
            approvedAt: new Date(),
            remarks: dto.remarks,
            updatedBy: approvedBy,
        }))!;
    }

    async processPayroll(id: string, processedBy: string): Promise<PayrollRunEntity> {
        const run = await this.getPayrollRun(id);

        if (run.status !== 'approved') {
            throw new Error('Payroll must be approved before processing');
        }

        const entries = await this.payrollRepository.findPayrollEntriesByRun(id);

        for (const entry of entries) {
            await this.payrollRepository.updatePayrollEntry(entry.id, {
                status: 'paid',
                updatedBy: processedBy,
            });

            await this.generatePayslip(id, entry.id, processedBy);
        }

        return (await this.payrollRepository.updatePayrollRun(id, {
            status: 'processed',
            processedBy,
            processedAt: new Date(),
            updatedBy: processedBy,
        }))!;
    }

    private async generatePayslip(payrollRunId: string, payrollEntryId: string, createdBy: string): Promise<PayslipEntity> {
        const entry = await this.payrollRepository.findPayrollEntryById(payrollEntryId);
        if (!entry) {
            throw new Error('Payroll entry not found');
        }

        const run = await this.getPayrollRun(payrollRunId);

        const payslipNumber = `PS-${run.code}-${entry.employeeId.substring(0, 8)}`;

        const earnings = entry.allowances.map((a) => ({
            description: a.name,
            amount: a.amount,
        }));

        earnings.unshift({ description: 'Basic Salary', amount: entry.baseSalary });

        const deductions = [
            { description: 'CAS (25%)', amount: entry.cas },
            { description: 'CASSS (10%)', amount: entry.casss },
            { description: 'Income Tax (10%)', amount: entry.incomeTax },
            ...entry.deductions.map((d) => ({
                description: d.name,
                amount: d.amount,
            })),
        ];

        return await this.payrollRepository.createPayslip({
            payrollRunId,
            payrollEntryId,
            employeeId: entry.employeeId,
            employeeCode: '',
            employeeName: '',
            month: run.month,
            year: run.year,
            payslipNumber,
            generatedDate: new Date(),
            baseSalary: entry.baseSalary,
            earnings,
            deductions,
            grossSalary: entry.grossSalary,
            totalDeductions: entry.totalDeductions,
            netSalary: entry.netSalary,
            status: 'generated',
            createdBy,
        });
    }

    private calculatePayrollTotals(entries: PayrollEntryEntity[]) {
        return {
            grossSalary: entries.reduce((sum, e) => sum + e.grossSalary, 0),
            netSalary: entries.reduce((sum, e) => sum + e.netSalary, 0),
            tax: entries.reduce((sum, e) => sum + e.totalTax, 0),
            cas: entries.reduce((sum, e) => sum + e.cas, 0),
            casss: entries.reduce((sum, e) => sum + e.casss, 0),
            deductions: entries.reduce((sum, e) => sum + e.totalDeductions, 0),
        };
    }

    private generatePayrollCode(month: number, year: number): string {
        return `PR-${year}-${String(month).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;
    }
}
