import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

/**
 * Login validation schema
 * Enforces email format and minimum password length
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
      'any.required': 'Email is required',
    }),
  password: Joi.string().min(1).required().messages({
    'string.min': 'Password is required',
    'string.empty': 'Password is required',
    'any.required': 'Password is required',
  }),
});

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
      'any.required': 'Email is required',
    }),
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string().hex().length(64).required().messages({
    'string.hex': 'Invalid token format',
    'string.length': 'Invalid token format',
    'string.empty': 'Token is required',
    'any.required': 'Token is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain uppercase, lowercase, and numbers',
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
});

/**
 * User registration validation schema
 * Enforces strong password requirements
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/)
    .pattern(/[a-z]/)
    .pattern(/[0-9]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain uppercase, lowercase, and numbers',
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  first_name: Joi.string().max(100).required().messages({
    'string.max': 'First name must be less than 100 characters',
    'string.empty': 'First name is required',
    'any.required': 'First name is required',
  }),
  last_name: Joi.string().max(100).required().messages({
    'string.max': 'Last name must be less than 100 characters',
    'string.empty': 'Last name is required',
    'any.required': 'Last name is required',
  }),
  phone_number: Joi.string().max(20).optional().allow('').messages({
    'string.max': 'Phone number must be less than 20 characters',
  }),
  role: Joi.string()
    .valid(
      'admin',
      'sales',
      'warehouse',
      'finance',
      'supplier_manager',
      'support',
      'b2b_user',
      'guest',
    )
    .optional(),
});

/**
 * Validation middleware factory
 * Validates request body against provided Joi schema
 */
export function validateBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    // Replace body with validated and sanitized value
    req.body = value;
    next();
  };
}
