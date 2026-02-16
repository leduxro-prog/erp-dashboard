import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('jwt-service');

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export class JwtService {
  private accessSecret: string;
  private refreshSecret: string;
  private accessExpiry: string;
  private refreshExpiry: string;
  private isProduction: boolean;

  constructor() {
    this.accessSecret = process.env.JWT_SECRET || '';
    if (!this.accessSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';
    if (!this.refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    this.accessExpiry = process.env.JWT_ACCESS_TOKEN_EXPIRY || process.env.JWT_EXPIRES_IN || '15m';
    this.refreshExpiry =
      process.env.JWT_REFRESH_TOKEN_EXPIRY || process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiry as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiry as jwt.SignOptions['expiresIn'],
    });
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.accessSecret) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, this.refreshSecret) as TokenPayload;
  }

  /**
   * Parse a duration string (e.g. '15m', '7d', '24h') into milliseconds.
   */
  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60 * 1000; // default 15 minutes
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const accessMaxAge = this.parseDurationToMs(this.accessExpiry);
    const refreshMaxAge = this.parseDurationToMs(this.refreshExpiry);

    // Access token cookie - short-lived
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: accessMaxAge,
      path: '/',
    });

    // Refresh token cookie - long-lived, restricted path
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: refreshMaxAge,
      path: '/api/v1/auth/refresh',
    });

    // Non-httpOnly cookie for frontend to know auth status
    res.cookie('auth_status', 'authenticated', {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: refreshMaxAge,
      path: '/',
    });

    logger.debug('Auth cookies set successfully');
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    res.clearCookie('auth_status', { path: '/' });

    logger.debug('Auth cookies cleared');
  }
}

let _jwtServiceInstance: JwtService | null = null;

/**
 * Lazily-initialized singleton. Defers construction until first access
 * so that env vars (JWT_SECRET, etc.) can be set before the service
 * is created — important for both production startup ordering and tests.
 */
export function getJwtService(): JwtService {
  if (!_jwtServiceInstance) {
    _jwtServiceInstance = new JwtService();
  }
  return _jwtServiceInstance;
}

/**
 * @deprecated Use getJwtService() instead. Kept for backward compatibility.
 * This getter ensures lazy initialization.
 */
export const jwtService: JwtService = new Proxy({} as JwtService, {
  get(_target, prop, receiver) {
    return Reflect.get(getJwtService(), prop, receiver);
  },
});
