/**
 * Express Request Type Extensions
 * Extends Express Request interface with custom properties used throughout the application
 */

declare global {
  namespace Express {
    /**
     * User context attached to requests after authentication
     */
    interface User {
      id: number | string;
      email: string;
      role: string;
      permissions?: string[];
    }

    /**
     * Extended Express Request with application-specific properties
     */
    interface Request {
      /**
       * Unique request ID for correlation and tracing
       * Set by request-id middleware
       */
      id: string;

      /**
       * Authenticated user information
       * Set by auth middleware
       */
      user?: User;

      /**
       * Validated request body
       * Set by validation middleware
       */
      validatedBody?: Record<string, unknown>;

      /**
       * Validated query params
       */
      validatedQuery?: Record<string, unknown>;

      /**
       * Validated path params
       */
      validatedParams?: Record<string, unknown>;

      /**
       * Legacy: alias for validatedBody
       */
      validated?: Record<string, unknown>;
    }
  }
}

export { };

