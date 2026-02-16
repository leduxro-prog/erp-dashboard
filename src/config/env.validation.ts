import Joi from 'joi';

export interface ConfigSchema {
  // Database
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;

  // Database Connection Pool
  DB_POOL_MAX?: number;
  DB_POOL_MIN?: number;
  DB_IDLE_TIMEOUT?: number;
  DB_CONNECTION_TIMEOUT?: number;
  DB_STATEMENT_TIMEOUT?: number;
  DB_LOGGING?: boolean;

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;

  // SmartBill
  SMARTBILL_API_URL?: string;
  SMARTBILL_USERNAME?: string;
  SMARTBILL_TOKEN?: string;

  // WooCommerce
  WOOCOMMERCE_URL?: string;
  WOOCOMMERCE_CONSUMER_KEY?: string;
  WOOCOMMERCE_CONSUMER_SECRET?: string;

  // Optional
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'staging' | 'test';
  CORS_ORIGINS?: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly';
  API_PREFIX: string;
  LOG_DIR: string;

  // AI
  GEMINI_API_KEY?: string;
}

const envValidationSchema = Joi.object<ConfigSchema>({
  // Database - Required
  DB_HOST: Joi.string().required().messages({
    'any.required': 'DB_HOST is required',
  }),
  DB_PORT: Joi.number().port().required().messages({
    'any.required': 'DB_PORT is required',
    'number.port': 'DB_PORT must be a valid port number',
  }),
  DB_NAME: Joi.string().required().messages({
    'any.required': 'DB_NAME is required',
  }),
  DB_USERNAME: Joi.string().required().messages({
    'any.required': 'DB_USERNAME is required',
  }),
  DB_PASSWORD: Joi.string().allow('').optional().default(''), // Allow empty password

  // Database Connection Pool - Optional with defaults
  DB_POOL_MAX: Joi.number().min(1).max(100).optional().default(20),
  DB_POOL_MIN: Joi.number().min(1).max(100).optional().default(5),
  DB_IDLE_TIMEOUT: Joi.number().min(1000).optional().default(30000),
  DB_CONNECTION_TIMEOUT: Joi.number().min(1000).optional().default(5000),
  DB_STATEMENT_TIMEOUT: Joi.number().min(1000).optional().default(30000),
  DB_LOGGING: Joi.boolean().optional().default(false),

  // Redis - Required
  REDIS_HOST: Joi.string().required().messages({
    'any.required': 'REDIS_HOST is required',
  }),
  REDIS_PORT: Joi.number().port().required().messages({
    'any.required': 'REDIS_PORT is required',
    'number.port': 'REDIS_PORT must be a valid port number',
  }),
  REDIS_PASSWORD: Joi.string().optional().allow('').default(''),

  // JWT - Required (but allowing defaults for dev if needed, kept required for security)
  JWT_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_SECRET is required',
    'string.min': 'JWT_SECRET must be at least 32 characters long',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required',
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters long',
  }),
  JWT_EXPIRES_IN: Joi.string().required().messages({
    'any.required': 'JWT_EXPIRES_IN is required',
  }),

  // SmartBill - Optional
  SMARTBILL_API_URL: Joi.string().uri().optional().allow('').default(''),
  SMARTBILL_USERNAME: Joi.string().optional().allow('').default(''),
  SMARTBILL_TOKEN: Joi.string().optional().allow('').default(''),

  // WooCommerce - Optional
  WOOCOMMERCE_URL: Joi.string().uri().optional().allow('').default(''),
  WOOCOMMERCE_CONSUMER_KEY: Joi.string().optional().allow('').default(''),
  WOOCOMMERCE_CONSUMER_SECRET: Joi.string().optional().allow('').default(''),

  // Optional
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'staging', 'test')
    .default('development'),
  CORS_ORIGINS: Joi.string().optional().allow(''),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose', 'silly')
    .default('info'),
  API_PREFIX: Joi.string().default('/api/v1'),
  LOG_DIR: Joi.string().default('logs'),

  // AI - Optional (can be configured from frontend settings)
  GEMINI_API_KEY: Joi.string().optional().allow('').default('').messages({
    'any.required': 'GEMINI_API_KEY is optional - can be configured from frontend',
  }),
})
  .unknown(true) // Allow unknown environment variables
  .required();

/**
 * Validate environment variables at application startup
 * @returns Validated configuration object
 * @throws Error if validation fails
 */
export function validateEnv(): ConfigSchema {
  const envVars = process.env;

  const { error, value } = envValidationSchema.validate(envVars, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false,
  });

  if (error) {
    const messages = error.details.map((detail) => detail.message).join(', ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return value as ConfigSchema;
}

export default validateEnv;
