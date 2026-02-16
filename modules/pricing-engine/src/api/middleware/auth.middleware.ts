import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('pricing-auth-middleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  validated?: any;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
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
    req.user = {
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
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 *
 * @param roles - Array of required roles (user must have at least one)
 * @returns Express middleware
 *
 * @example
 * router.post('/admin', requireRole(['admin']), handler)
 * router.post('/moderate', requireRole(['admin', 'moderator']), handler)
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Ensure user is authenticated
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required_roles: roles,
        user_role: req.user.role,
      });
      return;
    }

    next();
  };
};
