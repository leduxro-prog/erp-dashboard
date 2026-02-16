/**
 * Security Module
 * Enterprise-level security module for Cypher ERP
 *
 * This module provides comprehensive security features including:
 * - JWT authentication with session validation and revocation
 * - IDOR (Insecure Direct Object Reference) prevention
 * - Request validation and sanitization
 * - Role-based access control (RBAC)
 * - Security audit logging
 *
 * @module @cypher/security
 */

import { Application } from 'express';
import jwt from 'jsonwebtoken';
import { createModuleLogger } from '@shared/utils/logger';
import { getJwtParser, JwtParser } from './utils/JwtParser';
import {
  jwtAuth,
  requireRole,
  requirePermissions,
  getCustomerIdFromContext,
  verifyOwnership,
} from './middleware/JwtAuth';
import {
  preventIdor,
  verifyResourceOwnership,
  getAuthenticatedCustomerId,
} from './middleware/IdorPrevention';
import {
  validateRequest,
  preventCustomerIdInjection,
  sanitizeString,
  detectSqlInjection,
  detectXss,
  deepSanitize,
  SchemaBuilder,
} from './middleware/RequestValidator';
import { SecurityConfig } from './types/AuthContext';

const logger = createModuleLogger('security-module');

/**
 * Security module configuration
 */
interface SecurityModuleConfig {
  /** JWT secret for ERP tokens */
  jwtSecret?: string;

  /** JWT secret for B2B tokens */
  jwtSecretB2B?: string;

  /** Enable IDOR prevention (default: true) */
  enableIdorPrevention?: boolean;

  /** Enable request validation (default: true) */
  enableRequestValidation?: boolean;

  /** Enable audit logging (default: true) */
  enableAuditLogging?: boolean;

  /** Admin roles (default: ['admin', 'superadmin']) */
  adminRoles?: string[];

  /** Strict IDOR mode - block all attempts (default: true) */
  strictIdorMode?: boolean;

  /** Custom security configuration */
  customConfig?: Partial<SecurityConfig>;
}

/**
 * Default security module configuration
 */
const DEFAULT_CONFIG: SecurityModuleConfig = {
  enableIdorPrevention: true,
  enableRequestValidation: true,
  enableAuditLogging: true,
  adminRoles: ['admin', 'superadmin'],
  strictIdorMode: true,
};

/**
 * Security Module Class
 */
export class SecurityModule {
  private readonly config: SecurityModuleConfig;
  private readonly jwtParser: JwtParser;
  private initialized = false;

  constructor(config: SecurityModuleConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize JwtParser
    this.jwtParser = getJwtParser({
      jwtSecret: this.config.jwtSecret || process.env.JWT_SECRET || '',
      jwtSecretB2B: this.config.jwtSecretB2B || process.env.JWT_SECRET_B2B,
      issuer: 'cypher-erp',
      audience: 'cypher-erp-api',
    });

    logger.info('SecurityModule created', {
      idorPrevention: this.config.enableIdorPrevention,
      requestValidation: this.config.enableRequestValidation,
      auditLogging: this.config.enableAuditLogging,
      adminRoles: this.config.adminRoles,
    });
  }

  /**
   * Initialize security module
   * Registers JWT secrets and sets up dependencies
   */
  initialize(): void {
    if (this.initialized) {
      logger.warn('SecurityModule already initialized');
      return;
    }

    const jwtSecret = this.config.jwtSecret || process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // Verify JWT secret is properly configured
    try {
      const testToken = jwt.sign(
        { test: true },
        jwtSecret,
        { expiresIn: '1m' }
      );
      jwt.verify(testToken, jwtSecret);
      logger.info('JWT secret validated successfully');
    } catch (error) {
      throw new Error(`Invalid JWT secret: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.initialized = true;
    logger.info('SecurityModule initialized successfully');
  }

  /**
   * Apply security middleware to Express app
   *
   * @param app - Express application
   * @param options - Application options
   */
  applyToApp(
    app: Application,
    options: {
      /** Apply to all routes (default: true) */
      global?: boolean;

      /** Paths to skip (regex patterns) */
      skipPaths?: RegExp[];

      /** Paths requiring only B2B auth */
      b2bPaths?: RegExp[];
    } = {}
  ): void {
    const { global = true, skipPaths = [], b2bPaths = [] } = options;

    if (!this.initialized) {
      throw new Error('SecurityModule must be initialized before applying to app');
    }

    logger.info('Applying security middleware to Express app', {
      global,
      skipPaths: skipPaths.length,
      b2bPaths: b2bPaths.length,
    });

    if (global) {
      // Apply JWT auth globally
      app.use((req, res, next) => {
        // Skip specified paths
        for (const pattern of skipPaths) {
          if (pattern.test(req.path)) {
            next();
            return;
        }
        }

        // Check if this is a B2B path
        const isB2BPath = b2bPaths.some(pattern => pattern.test(req.path));

        if (isB2BPath) {
          jwtAuth({
            jwtSecret: this.config.jwtSecretB2B || process.env.JWT_SECRET_B2B,
            requiredRealm: 'b2b',
            checkRevocation: this.config.enableAuditLogging,
            validateSession: true,
            enableAuditLogging: this.config.enableAuditLogging,
          })(req, res, next);
        } else {
          jwtAuth({
            jwtSecret: this.config.jwtSecret || process.env.JWT_SECRET,
            requiredRealm: 'erp',
            checkRevocation: this.config.enableAuditLogging,
            validateSession: true,
            enableAuditLogging: this.config.enableAuditLogging,
          })(req, res, next);
        }
      });

      // Apply IDOR prevention
      if (this.config.enableIdorPrevention) {
        app.use((req, res, next) => {
          for (const pattern of skipPaths) {
            if (pattern.test(req.path)) {
              next();
              return;
            }
          }

          preventIdor({
            enabled: true,
            strictMode: this.config.strictIdorMode,
            logViolations: this.config.enableAuditLogging,
            adminRoles: this.config.adminRoles,
            skipPaths,
          })(req, res, next);
        });
      }

      // Apply request validation
      if (this.config.enableRequestValidation) {
        app.use((req, res, next) => {
          for (const pattern of skipPaths) {
            if (pattern.test(req.path)) {
              next();
              return;
            }
          }

          validateRequest({
            sanitizeInput: true,
            checkSqlInjection: true,
            checkXss: true,
            customerIdFields: ['customer_id', 'customerId', 'b2b_customer_id', 'b2bCustomerId'],
            blockedFields: ['user_id', 'userId'],
            stripBlockedFields: true,
          })(req, res, next);
        });
      }
    }
  }

  /**
   * Get the JwtParser instance
   */
  getJwtParser(): JwtParser {
    return this.jwtParser;
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityModuleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (not recommended after initialization)
   */
  updateConfig(updates: Partial<SecurityModuleConfig>): void {
    Object.assign(this.config, updates);
    logger.info('SecurityModule configuration updated', updates);
  }
}

/**
 * Singleton instance
 */
let securityModuleInstance: SecurityModule | null = null;

/**
 * Get or create the security module singleton
 *
 * @param config - Module configuration (only used on first call)
 * @returns SecurityModule instance
 *
 * @example
 * // Get or create security module
 * const security = getSecurityModule();
 *
 * // Initialize and apply to app
 * security.initialize();
 * security.applyToApp(app, {
 *   global: true,
 *   skipPaths: [/^\/health$/],
 *   b2bPaths: [/^\/api\/v1\/b2b/],
 * });
 */
export function getSecurityModule(config?: SecurityModuleConfig): SecurityModule {
  if (!securityModuleInstance && config) {
    securityModuleInstance = new SecurityModule(config);
  }

  if (!securityModuleInstance) {
    throw new Error(
      'SecurityModule not initialized. Call getSecurityModule(config) with config first.'
    );
  }

  return securityModuleInstance;
}

/**
 * Set the security module singleton (for testing)
 *
 * @param module - SecurityModule instance
 */
export function setSecurityModule(module: SecurityModule): void {
  securityModuleInstance = module;
}

/**
 * Reset the security module singleton (for testing)
 */
export function resetSecurityModule(): void {
  securityModuleInstance = null;
}

/**
 * Export all middleware for direct usage
 */
export const Middleware = {
  jwtAuth,
  requireRole,
  requirePermissions,
  preventIdor,
  validateRequest,
  preventCustomerIdInjection,
};

/**
 * Export all utilities for direct usage
 */
export const Utils = {
  getJwtParser,
  getCustomerIdFromContext,
  verifyOwnership,
  verifyResourceOwnership,
  getAuthenticatedCustomerId,
  sanitizeString,
  detectSqlInjection,
  detectXss,
  deepSanitize,
};

/**
 * Export schema builder for request validation
 */
export const Schemas = SchemaBuilder;

// Export types
export * from './types/AuthContext';
