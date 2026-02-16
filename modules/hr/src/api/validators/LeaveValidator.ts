import * as Joi from 'joi';

export class LeaveValidator {
    static createLeaveRequest() {
        return Joi.object({
            employeeId: Joi.string().uuid().required(),
            leaveTypeId: Joi.string().uuid().required(),
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso().required(),
            numberOfDays: Joi.number().positive().required(),
            reason: Joi.string(),
            attachmentPath: Joi.string(),
            reportingManagerId: Joi.string().uuid(),
            isBackfill: Joi.boolean(),
            backfillEmployeeId: Joi.string().uuid(),
        });
    }

    static updateLeaveRequest() {
        return Joi.object({
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso(),
            numberOfDays: Joi.number().positive(),
            reason: Joi.string(),
            attachmentPath: Joi.string(),
        });
    }

    static approveLeaveRequest() {
        return Joi.object({
            approvalRemarks: Joi.string(),
            approvalAttachmentPath: Joi.string(),
        });
    }

    static rejectLeaveRequest() {
        return Joi.object({
            rejectionReason: Joi.string().required(),
        });
    }

    static listQuery() {
        return Joi.object({
            page: Joi.number().integer().min(1),
            limit: Joi.number().integer().min(1).max(100),
            employeeId: Joi.string().uuid(),
            leaveTypeId: Joi.string().uuid(),
            status: Joi.string(),
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso(),
            sortBy: Joi.string(),
            sortOrder: Joi.string().valid('ASC', 'DESC'),
        });
    }
}
