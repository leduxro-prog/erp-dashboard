import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createModuleLogger } from '../utils/logger';
import { jwtService, TokenPayload } from '../services/JwtService';

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
  TQuery extends Record<string, unknown> = ValidatedRequestQuery,
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
 * Extract token from request.
 * Priority: 1) HttpOnly cookie  2) Authorization header (backwards compat)
 */
function extractAccessToken(req: Request): string | null {
  // 1. Try cookie first (preferred, HttpOnly)
  const cookieToken = (req as unknown as Record<string, unknown>).cookies as
    | Record<string, string>
    | undefined;
  if (cookieToken?.access_token) {
    return cookieToken.access_token;
  }

  // 2. Fall back to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Extract refresh token from cookies.
 */
function extractRefreshToken(req: Request): string | null {
  const cookies = (req as unknown as Record<string, unknown>).cookies as
    | Record<string, string>
    | undefined;
  return cookies?.refresh_token || null;
}

/**
 * Authentication Middleware
 * Verifies JWT token from HttpOnly cookies (primary) or Authorization header (fallback).
 * If access token is expired but a valid refresh token exists in cookies,
 * automatically refreshes the tokens and sets new cookies.
 *
 * @throws 401 if token is missing, invalid, or expired (and no refresh available)
 * @throws 500 if JWT_SECRET is not configured
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthenticatedRequest;
  try {
    const token = extractAccessToken(req);

    // Check for missing token
    if (!token) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

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
    // Handle expired token — attempt auto-refresh via refresh cookie
    if (error instanceof jwt.TokenExpiredError) {
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        try {
          const refreshPayload = jwtService.verifyRefreshToken(refreshToken);
          const tokenPayload: TokenPayload = {
            id: refreshPayload.id,
            email: refreshPayload.email,
            role: refreshPayload.role,
          };

          // Generate new token pair
          const newAccessToken = jwtService.generateAccessToken(tokenPayload);
          const newRefreshToken = jwtService.generateRefreshToken(tokenPayload);

          // Set new cookies on the response
          jwtService.setAuthCookies(res, newAccessToken, newRefreshToken);

          // Attach user to request and continue
          authReq.user = {
            id: refreshPayload.id,
            email: refreshPayload.email,
            role: refreshPayload.role || 'user',
          };

          logger.debug('Access token auto-refreshed via refresh cookie', {
            userId: refreshPayload.id,
          });

          next();
          return;
        } catch (refreshError) {
          logger.debug('Refresh token also invalid, requiring re-authentication');
        }
      }

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
      });
      return;
    }

    next();
  };
};
