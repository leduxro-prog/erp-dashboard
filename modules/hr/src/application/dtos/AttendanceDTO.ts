export interface ClockInDTO {
    employeeId: string;
    latitude?: number;
    longitude?: number;
    location?: string;
}

export interface ClockOutDTO {
    employeeId: string;
    latitude?: number;
    longitude?: number;
    location?: string;
}

export interface AttendanceRecordResponseDTO {
    id: string;
    employeeId: string;
    shiftId?: string;
    attendanceDate: string;
    clockInTime?: string;
    clockOutTime?: string;
    hoursWorked?: number;
    overtimeHours?: number;
    status: string;
    remarks?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AttendanceListQueryDTO {
    page?: number;
    limit?: number;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface AttendanceReportDTO {
    employeeId: string;
    employeeName: string;
    month: number;
    year: number;
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leftEarlyDays: number;
    totalOvertimeHours: number;
    attendancePercentage: number;
}
