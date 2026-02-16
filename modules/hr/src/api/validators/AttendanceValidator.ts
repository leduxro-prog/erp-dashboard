import * as Joi from 'joi';

export class AttendanceValidator {
    static clockIn() {
        return Joi.object({
            employeeId: Joi.string().uuid().required(),
            latitude: Joi.number().min(-90).max(90),
            longitude: Joi.number().min(-180).max(180),
            location: Joi.string(),
        });
    }

    static clockOut() {
        return Joi.object({
            employeeId: Joi.string().uuid().required(),
            latitude: Joi.number().min(-90).max(90),
            longitude: Joi.number().min(-180).max(180),
            location: Joi.string(),
        });
    }

    static listQuery() {
        return Joi.object({
            page: Joi.number().integer().min(1),
            limit: Joi.number().integer().min(1).max(100),
            employeeId: Joi.string().uuid(),
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso(),
            status: Joi.string(),
            sortBy: Joi.string(),
            sortOrder: Joi.string().valid('ASC', 'DESC'),
        });
    }
}
