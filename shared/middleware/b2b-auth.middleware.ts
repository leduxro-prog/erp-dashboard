import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export interface B2BJWTPayload {
  sub: string | number; // customer_id (B2B customer ID)
  email: string;
  role: string;
  realm: 'b2b';
  customer_id: string | number;
  tier?: string;
  company_name?: string;
  iat?: number;
  exp?: number;
}

export interface B2BAuthenticatedRequest extends Request {
  b2bCustomer?: {
    id: string | number;
    email: string;
    role: string;
    customer_id: string | number;
    tier?: string;
    company_name?: string;
  };
}

/**
 * Middleware to authenticate B2B customers using JWT tokens
 * Validates realm === 'b2b' and uses JWT_SECRET_B2B
 */
export const authenticateB2B = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const secret = process.env.JWT_SECRET_B2B;

  if (!secret) {
    console.error('JWT_SECRET_B2B not configured in environment');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service unavailable',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    // Verify decoded is an object and has the expected structure
    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format',
      });
      return;
    }

    const payload = decoded as unknown as B2BJWTPayload;

    // CRITICAL: Verify realm is 'b2b' to prevent ERP tokens from accessing B2B endpoints
    if (payload.realm !== 'b2b') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid token realm. B2B authentication required.',
      });
      return;
    }

    // Attach B2B customer info to request
    (req as B2BAuthenticatedRequest).b2bCustomer = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      customer_id: payload.customer_id,
      tier: payload.tier,
      company_name: payload.company_name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      return;
    }

    console.error('JWT verification error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
  }
};

/**
 * Middleware to require specific B2B customer tiers
 * Must be used AFTER authenticateB2B middleware
 */
export const requireB2BTier = (allowedTiers: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const b2bReq = req as B2BAuthenticatedRequest;

    if (!b2bReq.b2bCustomer) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'B2B authentication required',
      });
      return;
    }

    const customerTier = b2bReq.b2bCustomer.tier || 'STANDARD';

    if (!allowedTiers.includes(customerTier)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access restricted to ${allowedTiers.join(', ')} tier customers`,
      });
      return;
    }

    next();
  };
};
