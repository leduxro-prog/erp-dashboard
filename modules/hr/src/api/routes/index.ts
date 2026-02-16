import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { DataSource } from 'typeorm';
import { EmployeeController } from '../controllers/EmployeeController';
import { DepartmentController } from '../controllers/DepartmentController';
import { LeaveController } from '../controllers/LeaveController';
import { AttendanceController } from '../controllers/AttendanceController';
import { PayrollController } from '../controllers/PayrollController';
import { PerformanceController } from '../controllers/PerformanceController';
import { EmployeeValidator } from '../validators/EmployeeValidator';
import { LeaveValidator } from '../validators/LeaveValidator';
import { AttendanceValidator } from '../validators/AttendanceValidator';
import { PayrollValidator } from '../validators/PayrollValidator';
import { EmployeeService } from '../../domain/services/EmployeeService';
import { DepartmentService } from '../../domain/services/DepartmentService';
import { LeaveService } from '../../domain/services/LeaveService';
import { AttendanceService } from '../../domain/services/AttendanceService';
import { PayrollService } from '../../domain/services/PayrollService';
import { PerformanceService } from '../../domain/services/PerformanceService';
import { EmployeeRepository } from '../../infrastructure/repositories/EmployeeRepository';
import { DepartmentRepository } from '../../infrastructure/repositories/DepartmentRepository';
import { LeaveRepository } from '../../infrastructure/repositories/LeaveRepository';
import { AttendanceRepository } from '../../infrastructure/repositories/AttendanceRepository';
import { PayrollRepository } from '../../infrastructure/repositories/PayrollRepository';
import { PerformanceRepository } from '../../infrastructure/repositories/PerformanceRepository';

const validator = {
    body: (schema: Joi.ObjectSchema | Record<string, any>) => {
        return (req: Request, _res: Response, next: NextFunction) => {
            const joiSchema = Joi.isSchema(schema) ? schema : Joi.object(schema);
            const { error } = joiSchema.validate(req.body, { abortEarly: false, allowUnknown: true });
            if (error) {
                return next(error);
            }
            next();
        };
    },
    query: (schema: Joi.ObjectSchema | Record<string, any>) => {
        return (req: Request, _res: Response, next: NextFunction) => {
            const joiSchema = Joi.isSchema(schema) ? schema : Joi.object(schema);
            const { error } = joiSchema.validate(req.query, { abortEarly: false, allowUnknown: true });
            if (error) {
                return next(error);
            }
            next();
        };
    },
};

export function createHRRouter(dataSource: DataSource): Router {
    const router = Router();

    const employeeRepository = new EmployeeRepository(dataSource);
    const departmentRepository = new DepartmentRepository(dataSource);
    const leaveRepository = new LeaveRepository(dataSource);
    const attendanceRepository = new AttendanceRepository(dataSource);
    const payrollRepository = new PayrollRepository(dataSource);
    const performanceRepository = new PerformanceRepository(dataSource);

    const employeeService = new EmployeeService(employeeRepository);
    const departmentService = new DepartmentService(departmentRepository);
    const leaveService = new LeaveService(leaveRepository);
    const attendanceService = new AttendanceService(attendanceRepository);
    const payrollService = new PayrollService(payrollRepository);
    const performanceService = new PerformanceService(performanceRepository);

    const employeeController = new EmployeeController(employeeService);
    const departmentController = new DepartmentController(departmentService);
    const leaveController = new LeaveController(leaveService);
    const attendanceController = new AttendanceController(attendanceService);
    const payrollController = new PayrollController(payrollService);
    const performanceController = new PerformanceController(performanceService);

    router.post('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy' });
    });

    router.post(
        '/employees',
        validator.body(EmployeeValidator.createEmployee()),
        employeeController.create
    );
    router.get('/employees', employeeController.list);
    router.get('/employees/active', employeeController.getActive);
    router.get('/employees/:id', employeeController.getById);
    router.put(
        '/employees/:id',
        validator.body(EmployeeValidator.updateEmployee()),
        employeeController.update
    );
    router.post(
        '/employees/:id/terminate',
        validator.body(EmployeeValidator.terminateEmployee()),
        employeeController.terminate
    );
    router.delete('/employees/:id', employeeController.delete);
    router.get('/employees/department/:departmentId', employeeController.getByDepartment);
    router.get('/employees/manager/:managerId', employeeController.getByManager);

    router.post(
        '/departments',
        validator.body({ code: require('joi').string().required(), name: require('joi').string().required() }),
        departmentController.create
    );
    router.get('/departments', departmentController.list);
    router.get('/departments/all', departmentController.getAll);
    router.get('/departments/hierarchy', departmentController.getHierarchy);
    router.get('/departments/:id', departmentController.getById);
    router.put('/departments/:id', departmentController.update);
    router.delete('/departments/:id', departmentController.delete);
    router.get('/departments/:parentId/children', departmentController.getChildren);

    router.post(
        '/leave/requests',
        validator.body(LeaveValidator.createLeaveRequest()),
        leaveController.createLeaveRequest
    );
    router.get('/leave/requests', validator.query(LeaveValidator.listQuery()), leaveController.listLeaveRequests);
    router.get('/leave/requests/:id', leaveController.getLeaveRequest);
    router.put(
        '/leave/requests/:id',
        validator.body(LeaveValidator.updateLeaveRequest()),
        leaveController.updateLeaveRequest
    );
    router.post(
        '/leave/requests/:id/approve',
        validator.body(LeaveValidator.approveLeaveRequest()),
        leaveController.approveLeaveRequest
    );
    router.post(
        '/leave/requests/:id/reject',
        validator.body(LeaveValidator.rejectLeaveRequest()),
        leaveController.rejectLeaveRequest
    );
    router.get('/leave/balances/:employeeId/:leaveTypeId/:year', leaveController.getLeaveBalance);
    router.get('/leave/balances/:employeeId/:year', leaveController.getEmployeeLeaveBalances);
    router.post('/leave/balances', leaveController.allocateLeaveBalance);
    router.get('/leave/pending/:managerId', leaveController.getPendingLeaveRequests);

    router.post(
        '/attendance/clock-in',
        validator.body(AttendanceValidator.clockIn()),
        attendanceController.clockIn
    );
    router.post(
        '/attendance/clock-out',
        validator.body(AttendanceValidator.clockOut()),
        attendanceController.clockOut
    );
    router.get('/attendance', validator.query(AttendanceValidator.listQuery()), attendanceController.list);
    router.get('/attendance/:id', attendanceController.getRecord);
    router.get('/attendance/report/:employeeId/:month/:year', attendanceController.getAttendanceReport);
    router.get('/attendance/stats/:employeeId/:month/:year', attendanceController.getMonthlyStats);
    router.get('/attendance/pending/approvals', attendanceController.getPendingApprovals);
    router.post('/attendance/:id/approve', attendanceController.approveAttendance);

    router.post(
        '/payroll/runs',
        validator.body(PayrollValidator.createPayrollRun()),
        payrollController.createPayrollRun
    );
    router.get('/payroll/runs', validator.query(PayrollValidator.listQuery()), payrollController.listPayrollRuns);
    router.get('/payroll/runs/:id', payrollController.getPayrollRun);
    router.put(
        '/payroll/runs/:id',
        validator.body(PayrollValidator.updatePayrollRun()),
        payrollController.updatePayrollRun
    );
    router.post(
        '/payroll/runs/:payrollRunId/entries',
        validator.body({ employeeIds: require('joi').array().items(require('joi').string().uuid()) }),
        payrollController.createPayrollEntries
    );
    router.post(
        '/payroll/runs/:id/approve',
        validator.body(PayrollValidator.approvePayroll()),
        payrollController.approvePayroll
    );
    router.post('/payroll/runs/:id/process', payrollController.processPayroll);

    router.post(
        '/performance/reviews',
        validator.body({
            employeeId: require('joi').string().uuid().required(),
            reviewerId: require('joi').string().uuid().required(),
            reviewType: require('joi').string().required(),
            reviewYear: require('joi').number().required(),
            startDate: require('joi').date().required(),
            endDate: require('joi').date().required(),
        }),
        performanceController.createReview
    );
    router.get('/performance/reviews', performanceController.listReviews);
    router.get('/performance/reviews/:id', performanceController.getReview);
    router.put('/performance/reviews/:id', performanceController.updateReview);
    router.post('/performance/reviews/:id/submit', performanceController.submitReview);
    router.post('/performance/reviews/:id/approve', performanceController.approveReview);
    router.post('/performance/reviews/:id/acknowledge', performanceController.acknowledgeReview);

    router.post(
        '/performance/kpis',
        validator.body({
            employeeId: require('joi').string().uuid().required(),
            positionId: require('joi').string().uuid().required(),
            kpiName: require('joi').string().required(),
            kpiType: require('joi').string().required(),
            year: require('joi').number().required(),
            weightage: require('joi').number().required(),
        }),
        performanceController.createKPI
    );
    router.get('/performance/kpis/:id', performanceController.getKPI);
    router.put('/performance/kpis/:id', performanceController.updateKPI);
    router.get('/performance/kpis/employee/:employeeId/:year', performanceController.getEmployeeKPIs);

    router.post('/performance/reviews/:reviewId/ratings', performanceController.createRatings);
    router.get('/performance/reviews/:reviewId/ratings', performanceController.getReviewRatings);
    router.put('/performance/ratings/:id', performanceController.updateRating);
    router.post('/performance/reviews/:reviewId/calculate-rating', performanceController.calculateOverallRating);

    return router;
}

export default createHRRouter;
