import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('auth-middleware');

/**
 * Generic request body/query types for type-safe controller handlers
 */
export interface ValidatedRequestBody {
    [key: string]: unknown;
}

export interface ValidatedRequestQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    [key: string]: unknown;
}

export interface AuthenticatedRequest<
    TBody extends Record<string, unknown> = ValidatedRequestBody,
    TQuery extends Record<string, unknown> = ValidatedRequestQuery
> extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
    validatedBody?: TBody;
    validatedQuery?: TQuery;
}

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 * Attaches user data to request if valid
 *
 * @throws 401 if token is missing, invalid, or expired
 * @throws 500 if JWT_SECRET is not configured
 */
export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const authReq = req as AuthenticatedRequest;
    try {
        const authHeader = req.headers.authorization;

        // Check for missing token (401)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Missing or invalid authorization header' });
            return;
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET;

        // Verify JWT_SECRET is configured
        if (!secret) {
            logger.error('JWT_SECRET not configured in environment variables');
            res.status(500).json({ error: 'Server configuration error' });
            return;
        }

        // Verify token signature and decode payload
        const decoded = jwt.verify(token, secret) as {
            id: string;
            email: string;
            role: string;
        };

        // Attach user data to request
        authReq.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role || 'user',
        };

        next();
    } catch (error) {
        // Handle expired token (401)
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'Token has expired' });
            return;
        }

        // Handle invalid token (401)
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: 'Invalid or malformed token' });
            return;
        }

        // Generic error
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Role-based Access Control Middleware
 * Checks if the authenticated user has one of the required roles
 *
 * @param roles - Array of required roles (user must have at least one)
 * @returns Express middleware
 * @throws 401 if user is not authenticated
 * @throws 403 if user lacks required role
 *
 * @example
 * router.post('/admin', requireRole(['admin']), handler)
 * router.post('/moderate', requireRole(['admin', 'moderator']), handler)
 */
export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authReq = req as AuthenticatedRequest;
        // Ensure user is authenticated
        if (!authReq.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Check if user has required role
        if (!roles.includes(authReq.user.role)) {
            res.status(403).json({
                error: 'Insufficient permissions',
                required_roles: roles,
                user_role: authReq.user.role,
            });
            return;
        }

        next();
    };
};
