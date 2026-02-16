import * as Joi from 'joi';

export class EmployeeValidator {
    static createEmployee() {
        return Joi.object({
            code: Joi.string().alphanum().required(),
            userId: Joi.string().uuid().required(),
            firstName: Joi.string().max(100).required(),
            lastName: Joi.string().max(100).required(),
            email: Joi.string().email().required(),
            phone: Joi.string().max(20),
            dateOfBirth: Joi.date().iso().required(),
            gender: Joi.string().valid('male', 'female', 'other').required(),
            nationalIdNumber: Joi.string().max(20),
            passportNumber: Joi.string().max(20),
            address: Joi.string(),
            city: Joi.string().max(100),
            county: Joi.string().max(100),
            postalCode: Joi.string().max(10),
            country: Joi.string().max(100),
            emergencyContactPhone: Joi.string().max(20),
            emergencyContactName: Joi.string().max(255),
            emergencyContactRelation: Joi.string().max(50),
            departmentId: Joi.string().uuid().required(),
            positionId: Joi.string().uuid().required(),
            managerId: Joi.string().uuid(),
            hireDate: Joi.date().iso().required(),
            employmentType: Joi.string()
                .valid('full-time', 'part-time', 'contract', 'temporary', 'intern')
                .required(),
            baseSalary: Joi.number().positive().required(),
            salaryFrequency: Joi.string()
                .valid('daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annually')
                .required(),
            hoursPerWeek: Joi.number().positive(),
            bankAccountNumber: Joi.string().max(20),
            bankName: Joi.string().max(100),
            bankCode: Joi.string().max(50),
        });
    }

    static updateEmployee() {
        return Joi.object({
            firstName: Joi.string().max(100),
            lastName: Joi.string().max(100),
            email: Joi.string().email(),
            phone: Joi.string().max(20),
            dateOfBirth: Joi.date().iso(),
            gender: Joi.string().valid('male', 'female', 'other'),
            nationalIdNumber: Joi.string().max(20),
            passportNumber: Joi.string().max(20),
            address: Joi.string(),
            city: Joi.string().max(100),
            county: Joi.string().max(100),
            postalCode: Joi.string().max(10),
            country: Joi.string().max(100),
            emergencyContactPhone: Joi.string().max(20),
            emergencyContactName: Joi.string().max(255),
            emergencyContactRelation: Joi.string().max(50),
            departmentId: Joi.string().uuid(),
            positionId: Joi.string().uuid(),
            managerId: Joi.string().uuid(),
            baseSalary: Joi.number().positive(),
            salaryFrequency: Joi.string().valid(
                'daily',
                'weekly',
                'bi-weekly',
                'monthly',
                'quarterly',
                'annually'
            ),
            hoursPerWeek: Joi.number().positive(),
            bankAccountNumber: Joi.string().max(20),
            bankName: Joi.string().max(100),
            bankCode: Joi.string().max(50),
        });
    }

    static terminateEmployee() {
        return Joi.object({
            terminationDate: Joi.date().iso().required(),
            reason: Joi.string(),
        });
    }

    static listQuery() {
        return Joi.object({
            page: Joi.number().integer().min(1),
            limit: Joi.number().integer().min(1).max(100),
            search: Joi.string(),
            departmentId: Joi.string().uuid(),
            status: Joi.string(),
            employmentStatus: Joi.string(),
            managerId: Joi.string().uuid(),
            sortBy: Joi.string(),
            sortOrder: Joi.string().valid('ASC', 'DESC'),
        });
    }
}
