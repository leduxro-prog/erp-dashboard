export interface CreateEmployeeDTO {
    code: string;
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    nationalIdNumber?: string;
    passportNumber?: string;
    address?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    country?: string;
    emergencyContactPhone?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    departmentId: string;
    positionId: string;
    managerId?: string;
    hireDate: string;
    employmentType: 'full-time' | 'part-time' | 'contract' | 'temporary' | 'intern';
    baseSalary: number;
    salaryFrequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
    hoursPerWeek?: number;
    bankAccountNumber?: string;
    bankName?: string;
    bankCode?: string;
}

export interface UpdateEmployeeDTO {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    nationalIdNumber?: string;
    passportNumber?: string;
    address?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    country?: string;
    emergencyContactPhone?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    departmentId?: string;
    positionId?: string;
    managerId?: string;
    baseSalary?: number;
    salaryFrequency?: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'annually';
    hoursPerWeek?: number;
    bankAccountNumber?: string;
    bankName?: string;
    bankCode?: string;
}

export interface TerminateEmployeeDTO {
    terminationDate: string;
    reason?: string;
}

export interface EmployeeResponseDTO {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth: string;
    gender: string;
    departmentId: string;
    positionId: string;
    managerId?: string;
    hireDate: string;
    employmentStatus: string;
    employmentType: string;
    baseSalary: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface EmployeeListQueryDTO {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    status?: string;
    employmentStatus?: string;
    managerId?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
