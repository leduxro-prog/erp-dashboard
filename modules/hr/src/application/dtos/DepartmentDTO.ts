export interface CreateDepartmentDTO {
    code: string;
    name: string;
    description?: string;
    parentDepartmentId?: string;
    headId?: string;
    costCenter?: string;
}

export interface UpdateDepartmentDTO {
    code?: string;
    name?: string;
    description?: string;
    parentDepartmentId?: string;
    headId?: string;
    costCenter?: string;
    status?: 'active' | 'inactive' | 'archived';
}

export interface DepartmentResponseDTO {
    id: string;
    code: string;
    name: string;
    description?: string;
    parentDepartmentId?: string;
    headId?: string;
    costCenter?: string;
    headcount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DepartmentListQueryDTO {
    page?: number;
    limit?: number;
    search?: string;
    parentDepartmentId?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
