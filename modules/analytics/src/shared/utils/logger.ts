import winston from 'winston';
import path from 'path';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
        let meta = '';
        if (Object.keys(metadata as object).length > 0) {
            meta = ` ${JSON.stringify(metadata)}`;
        }
        return `${timestamp} [${level.toUpperCase()}] ${message}${meta}`;
    })
);

const logFormatColorized = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
        let meta = '';
        if (Object.keys(metadata as object).length > 0) {
            meta = ` ${JSON.stringify(metadata)}`;
        }
        return `${timestamp} [${level}] ${message}${meta}`;
    })
);

const logDirectory = process.env.LOG_DIR || 'logs';

const transports: winston.transport[] = [
    // Console transport (colorized)
    new winston.transports.Console({
        format: logFormatColorized,
        level: logLevel,
    }),
    // Error log file
    new winston.transports.File({
        filename: path.join(logDirectory, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
    }),
    // Combined log file
    new winston.transports.File({
        filename: path.join(logDirectory, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
    }),
];

const logger = winston.createLogger({
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: 'cypher-erp' },
    transports,
});

/**
 * Create a logger for a specific module with automatic prefix.
 * Returns a logger instance with the module name included in all log entries.
 * Enables structured logging and log filtering by module.
 *
 * Log levels (in order of severity):
 * - error: Error conditions
 * - warn: Warning conditions
 * - info: Informational messages
 * - http: HTTP request/response details
 * - debug: Debug-level messages (only in development)
 *
 * All logs include structured metadata with service name and module name.
 * Logs are written to:
 * - Console: Colorized output to terminal
 * - logs/error.log: Error-level logs only
 * - logs/combined.log: All logs
 *
 * @param moduleName - Name of the module (e.g., 'order-service', 'product-controller')
 * @returns Winston logger instance with module prefix in metadata
 *
 * @example
 * // In a service file
 * const logger = createModuleLogger('order-service');
 * logger.info('Order created', { orderId: 123, customerId: 456 });
 * // Output: 2025-02-07 10:30:00 [INFO] Order created {"module":"order-service","orderId":123,"customerId":456}
 *
 * @example
 * // Error logging with stack trace
 * logger.error('Failed to process order', {
 *   orderId: 123,
 *   error: err.message,
 *   stack: err.stack
 * });
 */
export function createModuleLogger(moduleName: string): winston.Logger {
    return logger.child({ module: moduleName });
}

export default logger;
