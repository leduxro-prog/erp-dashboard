import * as Joi from 'joi';

export class PayrollValidator {
    static createPayrollRun() {
        return Joi.object({
            name: Joi.string().max(100).required(),
            month: Joi.number().integer().min(1).max(12).required(),
            year: Joi.number().integer().min(2000).required(),
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso().required(),
            paymentDate: Joi.date().iso().required(),
            frequency: Joi.string()
                .valid('monthly', 'bi-weekly', 'weekly', 'quarterly', 'annually')
                .required(),
        });
    }

    static updatePayrollRun() {
        return Joi.object({
            name: Joi.string().max(100),
            paymentDate: Joi.date().iso(),
            remarks: Joi.string(),
        });
    }

    static processPayroll() {
        return Joi.object({
            payrollRunId: Joi.string().uuid().required(),
            employeeIds: Joi.array().items(Joi.string().uuid()),
        });
    }

    static approvePayroll() {
        return Joi.object({
            remarks: Joi.string(),
        });
    }

    static listQuery() {
        return Joi.object({
            page: Joi.number().integer().min(1),
            limit: Joi.number().integer().min(1).max(100),
            month: Joi.number().integer().min(1).max(12),
            year: Joi.number().integer().min(2000),
            status: Joi.string(),
            sortBy: Joi.string(),
            sortOrder: Joi.string().valid('ASC', 'DESC'),
        });
    }
}
