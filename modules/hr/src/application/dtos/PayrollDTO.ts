export interface CreatePayrollRunDTO {
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
    paymentDate: string;
    frequency: 'monthly' | 'bi-weekly' | 'weekly' | 'quarterly' | 'annually';
}

export interface UpdatePayrollRunDTO {
    name?: string;
    paymentDate?: string;
    remarks?: string;
}

export interface ProcessPayrollDTO {
    payrollRunId: string;
    employeeIds?: string[];
}

export interface ApprovePayrollDTO {
    remarks?: string;
}

export interface PayrollRunResponseDTO {
    id: string;
    code: string;
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
    paymentDate: string;
    frequency: string;
    totalEmployees: number;
    totalGrossSalary: number;
    totalNetSalary: number;
    totalTax: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PayslipResponseDTO {
    id: string;
    payrollRunId: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    month: number;
    year: number;
    payslipNumber: string;
    baseSalary: number;
    earnings: { description: string; amount: number }[];
    deductions: { description: string; amount: number }[];
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    status: string;
    generatedDate: Date;
}

export interface PayrollListQueryDTO {
    page?: number;
    limit?: number;
    month?: number;
    year?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
