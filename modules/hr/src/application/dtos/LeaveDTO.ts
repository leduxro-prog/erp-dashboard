export interface CreateLeaveRequestDTO {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    numberOfDays: number;
    reason?: string;
    attachmentPath?: string;
    reportingManagerId?: string;
    isBackfill?: boolean;
    backfillEmployeeId?: string;
}

export interface UpdateLeaveRequestDTO {
    startDate?: string;
    endDate?: string;
    numberOfDays?: number;
    reason?: string;
    attachmentPath?: string;
}

export interface ApproveLeaveRequestDTO {
    approvalRemarks?: string;
    approvalAttachmentPath?: string;
}

export interface RejectLeaveRequestDTO {
    rejectionReason: string;
}

export interface LeaveRequestResponseDTO {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    numberOfDays: number;
    reason?: string;
    status: string;
    approvedBy?: string;
    approvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface LeaveBalanceResponseDTO {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    allocatedDays: number;
    usedDays: number;
    carriedOverDays: number;
    pendingDays: number;
    availableDays: number;
    lastUpdated?: Date;
}

export interface LeaveRequestListQueryDTO {
    page?: number;
    limit?: number;
    employeeId?: string;
    leaveTypeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
