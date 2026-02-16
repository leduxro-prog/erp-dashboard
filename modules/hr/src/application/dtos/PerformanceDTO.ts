export interface CreatePerformanceReviewDTO {
    employeeId: string;
    reviewerId: string;
    reviewType: 'annual' | 'quarterly' | 'probation' | '360-degree' | 'mid-year';
    reviewYear: number;
    reviewQuarter?: number;
    startDate: string;
    endDate: string;
}

export interface UpdatePerformanceReviewDTO {
    overallComments?: string;
    strengthsIdentified?: string;
    areasForImprovement?: string;
    developmentPlan?: string;
    overallRating?: number;
}

export interface CreatePerformanceKPIDTO {
    employeeId: string;
    positionId: string;
    kpiName: string;
    description?: string;
    kpiType: 'qualitative' | 'quantitative' | 'behavioral';
    year: number;
    weightage: number;
    targetValue?: number;
    unit?: string;
    startDate?: string;
    endDate?: string;
}

export interface UpdatePerformanceKPIDTO {
    kpiName?: string;
    description?: string;
    weightage?: number;
    targetValue?: number;
    achievedValue?: number;
    status?: string;
    remarks?: string;
}

export interface PerformanceReviewResponseDTO {
    id: string;
    employeeId: string;
    reviewerId: string;
    reviewType: string;
    reviewYear: number;
    startDate: string;
    endDate: string;
    overallComments?: string;
    overallRating?: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PerformanceKPIResponseDTO {
    id: string;
    employeeId: string;
    positionId: string;
    kpiName: string;
    kpiType: string;
    year: number;
    weightage: number;
    targetValue?: number;
    achievedValue?: number;
    achievementPercentage?: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PerformanceReviewListQueryDTO {
    page?: number;
    limit?: number;
    employeeId?: string;
    reviewerId?: string;
    reviewType?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
