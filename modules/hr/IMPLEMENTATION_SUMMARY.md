# HR Module Implementation Summary

## Overview

This is a complete, production-ready Human Resources (HR) module for Cypher ERP. It provides comprehensive functionality for managing employees, departments, attendance, leave, payroll, and performance management.

## Architecture

The module follows clean architecture principles with clear separation of concerns:

```
hr/
├── src/
│   ├── api/
│   │   ├── controllers/    # Express controllers handling HTTP requests
│   │   ├── routes/         # Express Router definitions
│   │   └── validators/     # JOI validation schemas
│   ├── application/
│   │   └── dtos/           # Data Transfer Objects
│   ├── domain/
│   │   └── services/       # Business logic and domain operations
│   ├── infrastructure/
│   │   ├── entities/       # TypeORM entities
│   │   ├── repositories/   # Database access layer
│   │   ├── cache/          # Caching layer (optional)
│   │   └── mappers/        # Entity to DTO mappers
│   └── index.ts            # Module exports
├── tests/                  # Test files
└── IMPLEMENTATION_SUMMARY.md
```

## Core Features Implemented

### 1. Employee Management
- **Full CRUD operations** for employee profiles
- **Personal information**: name, email, phone, DoB, gender, nationality
- **Contact details**: address, city, county, postal code, country
- **Emergency contact** information
- **Employment details**: department, position, manager, hire date
- **Bank account** information for payroll
- **Employment lifecycle**: active, probation, contract, suspended, terminated, resigned
- **Soft delete** functionality for data preservation
- **Advanced search and filtering** with pagination
- **Organizational hierarchy** support

### 2. Department Management
- **Full CRUD operations** for departments
- **Hierarchical structure** support (parent-child relationships)
- **Department head assignment** with cost center tracking
- **Headcount tracking** per department
- **Department hierarchy visualization**
- **Status management** (active, inactive, archived)

### 3. Employee Positions/Job Titles
- **Position definitions** with grade and level
- **Base salary templates** per position
- **Responsibility descriptions**
- **Qualification requirements**
- **Headcount management** per position

### 4. Attendance & Time Tracking
- **Clock in/out** functionality with timestamp recording
- **Geolocation support** for tracking (latitude/longitude)
- **Location name** recording
- **Hours worked** automatic calculation
- **Overtime tracking** and calculation
- **Shift assignment** support
- **Attendance status** tracking (present, absent, late, left-early)
- **Attendance reports** by employee and period
- **Monthly attendance statistics**
- **Pending approval workflow** for anomalies

### 5. Leave Management
- **Multiple leave types** support (annual, sick, maternity, etc.)
- **Leave request workflow**: pending → approved/rejected → on-leave
- **Leave balance tracking** by type and year
- **Automatic balance calculation** with available days computation
- **Carryover allowances** from previous years
- **Leave accrual policies** support
- **Backfill employee assignment** during leave
- **Holiday calendar** management (national, company, regional, optional)
- **Leave approval by manager** with remarks
- **Rejection workflow** with reason tracking
- **Minimum notice period** enforcement

### 6. Payroll Processing
- **Monthly, bi-weekly, weekly, quarterly, and annual** payroll runs
- **Romanian tax calculations** (CAS 25%, CASS 10%, Income Tax 10%)
- **Salary structure** definition with allowances and deductions
- **Payroll entry creation** for each employee
- **Tax calculations** with configurable tax rates
- **Payslip generation** with detailed breakdown
- **Payroll status** workflow: draft → submitted → approved → processed → paid
- **Approval workflow** with remarks
- **Bulk payroll processing** for multiple employees
- **Overtime calculation** and inclusion in payroll
- **Meal vouchers** support (Romanian-specific)
- **Payroll reports** and analytics

### 7. Performance Management
- **Review types**: annual, quarterly, probation, 360-degree, mid-year
- **KPI (Key Performance Indicator) management** with:
  - Qualitative, quantitative, and behavioral types
  - Target value tracking
  - Achievement percentage calculation
  - Weightage distribution
- **Performance review workflow**: pending → in-progress → submitted → approved → completed
- **360-degree feedback** support
- **Individual KPI rating** with feedback
- **Overall rating calculation** based on weighted KPI scores
- **Performance ratings** (1-5 scale or custom)
- **Employee acknowledgment** of reviews
- **Development plans** per review

## Database Schema

### Core Tables

#### Departments
- `id` (UUID, PK)
- `code` (VARCHAR 50, UNIQUE)
- `name` (VARCHAR 255)
- `description` (TEXT)
- `parentDepartmentId` (UUID, FK to departments)
- `headId` (UUID)
- `costCenter` (VARCHAR 50)
- `headcount` (INTEGER)
- `status` (VARCHAR 20: active, inactive, archived)
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

#### Employees
- `id` (UUID, PK)
- `code` (VARCHAR 50, UNIQUE)
- `userId` (UUID, FK to users)
- `firstName`, `lastName` (VARCHAR 100)
- `email` (VARCHAR 255, UNIQUE)
- `phone` (VARCHAR 20)
- `dateOfBirth` (DATE)
- `gender` (VARCHAR 50)
- `nationalIdNumber` (VARCHAR 20)
- `passportNumber` (VARCHAR 20)
- `address`, `city`, `county`, `postalCode`, `country`
- `emergencyContactName`, `emergencyContactPhone`, `emergencyContactRelation`
- `departmentId` (UUID, FK)
- `positionId` (UUID, FK)
- `managerId` (UUID, FK to employees)
- `hireDate` (DATE)
- `terminationDate` (DATE)
- `employmentStatus` (active, probation, contract, suspended, terminated, resigned)
- `employmentType` (full-time, part-time, contract, temporary, intern)
- `baseSalary` (DECIMAL 12,2)
- `salaryFrequency` (daily, weekly, bi-weekly, monthly, quarterly, annually)
- `hoursPerWeek` (DECIMAL 5,2)
- `bankAccountNumber`, `bankName`, `bankCode`
- `status`, `isDeleted`
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

#### EmployeePositions
- `id` (UUID, PK)
- `code` (VARCHAR 50, UNIQUE)
- `title` (VARCHAR 255)
- `description` (TEXT)
- `departmentId` (UUID, FK)
- `grade`, `level` (VARCHAR 50)
- `baseSalary` (DECIMAL 12,2)
- `headcount` (INTEGER)
- `status`
- `responsibilities`, `requiredQualifications` (TEXT)
- Timestamps

#### AttendanceRecords
- `id` (UUID, PK)
- `employeeId` (UUID, FK)
- `shiftId` (UUID, FK)
- `attendanceDate` (DATE)
- `clockInTime`, `clockOutTime` (TIME)
- `clockInLatitude`, `clockInLongitude` (DECIMAL 9,6)
- `clockOutLatitude`, `clockOutLongitude` (DECIMAL 9,6)
- `clockInLocation`, `clockOutLocation` (VARCHAR 255)
- `hoursWorked`, `overtimeHours` (DECIMAL 5,2)
- `status` (pending, present, absent, late, left-early, approved, rejected)
- `remarks`, `approvedBy`, `approvedAt`
- Timestamps

#### LeaveTypes
- `id` (UUID, PK)
- `code` (VARCHAR 50, UNIQUE)
- `name` (VARCHAR 100)
- `description` (TEXT)
- `defaultDaysPerYear` (DECIMAL 6,2)
- `requiresApproval` (BOOLEAN)
- `paidLeave` (BOOLEAN)
- `maxConsecutiveDays`, `minimumNoticeDays` (INTEGER)
- `carryOverAllowed` (BOOLEAN)
- `maxCarryOverDays` (INTEGER)
- `status`, `displayOrder`
- Timestamps

#### LeaveBalances
- `id` (UUID, PK)
- `employeeId` (UUID, FK)
- `leaveTypeId` (UUID, FK)
- `year` (INTEGER)
- `allocatedDays` (DECIMAL 6,2)
- `usedDays` (DECIMAL 6,2)
- `carriedOverDays` (DECIMAL 6,2)
- `pendingDays` (DECIMAL 6,2)
- `availableDays` (calculated: allocated + carriedOver - used - pending)
- `lastUpdated` (DATE)
- Timestamps

#### LeaveRequests
- `id` (UUID, PK)
- `employeeId` (UUID, FK)
- `leaveTypeId` (UUID, FK)
- `startDate`, `endDate` (DATE)
- `numberOfDays` (DECIMAL 6,2)
- `reason`, `attachmentPath` (TEXT)
- `status` (pending, approved, rejected, cancelled, on-leave)
- `approvedBy`, `approvedAt` (UUID, DATE)
- `approvalRemarks`, `approvalAttachmentPath`
- `rejectionReason` (TEXT)
- `reportingManagerId` (UUID, FK)
- `isBackfill` (BOOLEAN)
- `backfillEmployeeId` (UUID, FK)
- Timestamps

#### PayrollRuns
- `id` (UUID, PK)
- `code` (VARCHAR 50, UNIQUE)
- `name` (VARCHAR 100)
- `month`, `year` (INTEGER)
- `startDate`, `endDate`, `paymentDate` (DATE)
- `frequency` (monthly, bi-weekly, weekly, quarterly, annually)
- `totalEmployees` (INTEGER)
- `totalGrossSalary`, `totalNetSalary` (DECIMAL 15,2)
- `totalTax`, `totalCAS`, `totalCASSS`, `totalDeductions` (DECIMAL 15,2)
- `status` (draft, submitted, approved, processed, paid, cancelled)
- `approvedBy`, `approvedAt` (UUID, DATE)
- `processedBy`, `processedAt` (UUID, DATE)
- `remarks` (TEXT)
- Timestamps

#### PayrollEntries
- `id` (UUID, PK)
- `payrollRunId` (UUID, FK)
- `employeeId` (UUID, FK)
- `salaryStructureId` (UUID, FK)
- `baseSalary` (DECIMAL 12,2)
- `allowances`, `deductions` (JSON array)
- `grossSalary`, `cas`, `casss`, `incomeTax`, `totalTax`, `totalDeductions`, `netSalary` (DECIMAL 12,2)
- `workingDays`, `absentDays` (INTEGER)
- `overtimeHours` (DECIMAL 6,2)
- `overtimeAmount` (DECIMAL 12,2)
- `status` (pending, approved, rejected, paid, cancelled)
- `approvedBy`, `approvedAt` (UUID, DATE)
- `remarks`
- Timestamps

#### Payslips
- `id` (UUID, PK)
- `payrollRunId` (UUID, FK)
- `payrollEntryId` (UUID, FK)
- `employeeId` (UUID, FK)
- `employeeCode`, `employeeName` (VARCHAR)
- `month`, `year` (INTEGER)
- `payslipNumber` (VARCHAR 50, UNIQUE)
- `generatedDate` (DATE)
- `pdfPath` (TEXT)
- `baseSalary` (DECIMAL 12,2)
- `earnings`, `deductions` (JSON)
- `grossSalary`, `totalDeductions`, `netSalary` (DECIMAL 12,2)
- `status` (draft, generated, sent, viewed, archived)
- `sentTo`, `viewedAt` (DATE)
- Timestamps

#### PerformanceReviews
- `id` (UUID, PK)
- `employeeId` (UUID, FK)
- `reviewerId` (UUID, FK)
- `reviewType` (annual, quarterly, probation, 360-degree, mid-year)
- `reviewYear`, `reviewQuarter` (INTEGER)
- `startDate`, `endDate`, `reviewDate` (DATE)
- `overallComments`, `strengthsIdentified`, `areasForImprovement`, `developmentPlan` (TEXT)
- `overallRating` (DECIMAL 3,1)
- `status` (pending, in-progress, completed, submitted, approved, archived)
- `approvedBy`, `approvedAt` (UUID, DATE)
- `employeeAcknowledged` (BOOLEAN)
- `acknowledgedAt` (DATE)
- Timestamps

#### PerformanceKPIs
- `id` (UUID, PK)
- `employeeId` (UUID, FK)
- `positionId` (UUID, FK)
- `kpiName` (VARCHAR 255)
- `description` (TEXT)
- `kpiType` (qualitative, quantitative, behavioral)
- `year` (INTEGER)
- `weightage` (DECIMAL 5,2)
- `targetValue` (DECIMAL 10,2)
- `unit` (VARCHAR 50)
- `startDate`, `endDate` (DATE)
- `achievedValue` (DECIMAL 10,2)
- `achievementPercentage` (DECIMAL 5,2)
- `status` (not-started, in-progress, completed, achieved, not-achieved, on-hold)
- `remarks`
- Timestamps

#### PerformanceRatings
- `id` (UUID, PK)
- `reviewId` (UUID, FK)
- `kpiId` (UUID, FK)
- `kpiName` (VARCHAR 255)
- `weightage` (DECIMAL 5,2)
- `rating` (DECIMAL 5,2)
- `feedback` (TEXT)
- `status` (pending, rated, reviewed, finalized)
- Timestamps

## API Endpoints

### Employee Management
- `POST /hr/employees` - Create employee
- `GET /hr/employees` - List employees (paginated)
- `GET /hr/employees/:id` - Get employee by ID
- `PUT /hr/employees/:id` - Update employee
- `POST /hr/employees/:id/terminate` - Terminate employee
- `DELETE /hr/employees/:id` - Soft delete employee
- `GET /hr/employees/department/:departmentId` - Get employees by department
- `GET /hr/employees/manager/:managerId` - Get employees by manager
- `GET /hr/employees/active` - Get active employees

### Department Management
- `POST /hr/departments` - Create department
- `GET /hr/departments` - List departments (paginated)
- `GET /hr/departments/all` - Get all active departments
- `GET /hr/departments/hierarchy` - Get department hierarchy
- `GET /hr/departments/:id` - Get department by ID
- `PUT /hr/departments/:id` - Update department
- `DELETE /hr/departments/:id` - Archive department
- `GET /hr/departments/:parentId/children` - Get child departments

### Leave Management
- `POST /hr/leave/requests` - Create leave request
- `GET /hr/leave/requests` - List leave requests (paginated)
- `GET /hr/leave/requests/:id` - Get leave request
- `PUT /hr/leave/requests/:id` - Update leave request
- `POST /hr/leave/requests/:id/approve` - Approve leave request
- `POST /hr/leave/requests/:id/reject` - Reject leave request
- `GET /hr/leave/balances/:employeeId/:leaveTypeId/:year` - Get leave balance
- `GET /hr/leave/balances/:employeeId/:year` - Get all leave balances for employee
- `POST /hr/leave/balances` - Allocate leave balance
- `GET /hr/leave/pending/:managerId` - Get pending approvals

### Attendance Management
- `POST /hr/attendance/clock-in` - Clock in
- `POST /hr/attendance/clock-out` - Clock out
- `GET /hr/attendance` - List attendance records (paginated)
- `GET /hr/attendance/:id` - Get attendance record
- `GET /hr/attendance/report/:employeeId/:month/:year` - Get attendance report
- `GET /hr/attendance/stats/:employeeId/:month/:year` - Get monthly statistics
- `GET /hr/attendance/pending/approvals` - Get pending approvals
- `POST /hr/attendance/:id/approve` - Approve attendance

### Payroll Management
- `POST /hr/payroll/runs` - Create payroll run
- `GET /hr/payroll/runs` - List payroll runs (paginated)
- `GET /hr/payroll/runs/:id` - Get payroll run
- `PUT /hr/payroll/runs/:id` - Update payroll run
- `POST /hr/payroll/runs/:payrollRunId/entries` - Create payroll entries
- `POST /hr/payroll/runs/:id/approve` - Approve payroll
- `POST /hr/payroll/runs/:id/process` - Process and generate payslips

### Performance Management
- `POST /hr/performance/reviews` - Create performance review
- `GET /hr/performance/reviews` - List reviews (paginated)
- `GET /hr/performance/reviews/:id` - Get review
- `PUT /hr/performance/reviews/:id` - Update review
- `POST /hr/performance/reviews/:id/submit` - Submit review
- `POST /hr/performance/reviews/:id/approve` - Approve review
- `POST /hr/performance/reviews/:id/acknowledge` - Acknowledge review
- `POST /hr/performance/kpis` - Create KPI
- `GET /hr/performance/kpis/:id` - Get KPI
- `PUT /hr/performance/kpis/:id` - Update KPI
- `GET /hr/performance/kpis/employee/:employeeId/:year` - Get employee KPIs
- `POST /hr/performance/reviews/:reviewId/ratings` - Create ratings
- `GET /hr/performance/reviews/:reviewId/ratings` - Get review ratings
- `PUT /hr/performance/ratings/:id` - Update rating
- `POST /hr/performance/reviews/:reviewId/calculate-rating` - Calculate overall rating

## Key Features

### Advanced Business Logic

1. **Leave Balance Management**
   - Automatic calculation of available days
   - Carryover enforcement
   - Pending leave tracking
   - Balance updates on approval/rejection

2. **Payroll Calculations**
   - Romanian tax system (CAS 25%, CASS 10%, Income Tax 10%)
   - Multiple salary components
   - Automatic gross and net calculation
   - Overtime tracking and compensation
   - Payslip generation

3. **Attendance Tracking**
   - Geolocation support for clock-in/out
   - Automatic hours worked calculation
   - Overtime detection
   - Monthly statistics and reporting
   - Pending approval workflow

4. **Performance Management**
   - Weighted KPI scoring
   - Automatic overall rating calculation
   - 360-degree feedback support
   - Employee acknowledgment tracking
   - Development plan management

### Data Integrity

- **Soft deletes** for employee records
- **Foreign key relationships** with cascade options
- **Unique constraints** on codes and identifiers
- **Check constraints** for valid status values
- **Transaction support** for multi-step operations

### Security & Authorization

- **User-based audit trails** (createdBy, updatedBy)
- **Timestamp tracking** for all entities
- **Status-based access control** ready
- **Department-based filtering** support
- **Manager-based hierarchy** enforcement

## Validation

All inputs are validated using JOI schemas:
- Email format validation
- Date range validation
- Numeric range validation
- Enum value validation
- Required field enforcement
- UUID format validation

## Error Handling

- Custom error messages
- HTTP status codes
- Error response format
- Validation error details

## Performance Optimizations

- **Indexed queries** on frequently searched fields:
  - Employee code, email, department, status
  - Attendance date, status
  - Leave request status, date range
  - Payroll month/year, status

- **Pagination support** for large datasets
- **Relationship loading** optimization (select specific fields)
- **Bulk operations** for payroll processing

## Testing

The module includes comprehensive test coverage for:
- Service logic
- Controller endpoints
- Repository operations
- Validation rules
- Error scenarios

## Future Enhancements

1. **Shift management** advanced features
2. **Biometric integration** for attendance
3. **Mobile app** support
4. **Advanced reporting** and dashboards
5. **Integration** with accounting module
6. **Email notifications** for approvals
7. **Document management** for contracts
8. **Skills management** and training
9. **Succession planning**
10. **Custom tax calculations** per region

## Dependencies

- TypeORM for database operations
- Express for HTTP server
- JOI for validation
- UUID for ID generation
- Shared utilities from @shared/utils

## Module Metadata

```typescript
{
  name: 'hr',
  version: '1.0.0',
  description: 'Human Resources - Employees, Attendance, Leave, Performance, Payroll',
  dependencies: ['users'],
  publishedEvents: [
    'employee.created',
    'employee.updated',
    'employee.terminated',
    'leave.requested',
    'leave.approved',
    'leave.rejected',
    'attendance.clocked-in',
    'attendance.clocked-out',
    'payroll.created',
    'payroll.processed',
    'performance.review.created',
    'performance.review.completed',
  ],
  subscribedEvents: ['user.created'],
  featureFlag: 'HR_MODULE'
}
```

## Production Readiness

- Full error handling and logging
- Database migrations ready
- Comprehensive documentation
- Clean code architecture
- SOLID principles followed
- No hardcoded values
- Configurable parameters
- Romanian-specific tax calculations
- Enterprise-grade data models
