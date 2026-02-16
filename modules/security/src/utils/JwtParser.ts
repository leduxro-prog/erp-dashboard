/**
 * JwtParser Utility
 * Enterprise-level JWT parsing and validation utilities
 */

import jwt, {
  JwtPayload as JwtLibPayload,
  TokenExpiredError,
  JsonWebTokenError,
  NotBeforeError,
  SignOptions,
} from 'jsonwebtoken';
import { JwtPayload, SecurityContext, TokenRevocationCheck, SessionValidationResult } from '../types/AuthContext';

/**
 * JWT Parser class for token validation and parsing
 */
export class JwtParser {
  private readonly jwtSecret: string;
  private readonly jwtSecretB2B?: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(config: {
    jwtSecret: string;
    jwtSecretB2B?: string;
    issuer?: string;
    audience?: string;
  }) {
    this.jwtSecret = config.jwtSecret;
    this.jwtSecretB2B = config.jwtSecretB2B;
    this.issuer = config.issuer || 'cypher-erp';
    this.audience = config.audience || 'cypher-erp-api';
  }

  /**
   * Parse and validate JWT token from Authorization header
   *
   * @param authHeader - Authorization header value (Bearer <token>)
   * @returns Parsed JWT payload
   * @throws UnauthorizedError for invalid/missing tokens
   */
  parseFromAuthHeader(authHeader: string | undefined): JwtPayload {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return this.parseToken(token);
  }

  /**
   * Parse and validate JWT token
   *
   * @param token - JWT token string
   * @param secret - Optional secret (defaults to configured secret)
   * @returns Parsed JWT payload
   * @throws UnauthorizedError for invalid tokens
   */
  parseToken(token: string, secret?: string): JwtPayload {
    const secretToUse = secret || this.jwtSecret;

    if (!secretToUse) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      const decoded = jwt.verify(token, secretToUse, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
      }) as JwtLibPayload;

      return this.normalizePayload(decoded);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedError('Token has expired', error.expiredAt);
      }

      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedError(`Invalid token: ${error.message}`);
      }

      if (error instanceof NotBeforeError) {
        throw new UnauthorizedError('Token not yet valid', error.date);
      }

      throw new UnauthorizedError('Token validation failed');
    }
  }

  /**
   * Parse token without verification (for debugging/inspection only)
   * WARNING: Do not use for authorization decisions
   *
   * @param token - JWT token string
   * @returns Decoded payload (unverified)
   */
  decodeUnverified(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtLibPayload | null;
      return decoded ? this.normalizePayload(decoded) : null;
    } catch {
      return null;
    }
  }

  /**
   * Verify B2B-specific JWT token
   *
   * @param authHeader - Authorization header value
   * @returns Parsed B2B JWT payload
   * @throws UnauthorizedError for invalid tokens
   */
  parseB2BToken(authHeader: string | undefined): JwtPayload {
    if (!this.jwtSecretB2B) {
      throw new Error('JWT_SECRET_B2B not configured');
    }

    const payload = this.parseFromAuthHeader(authHeader);

    if (payload.realm !== 'b2b') {
      throw new UnauthorizedError('Invalid token realm. B2B authentication required.');
    }

    return payload;
  }

  /**
   * Build security context from JWT payload
   *
   * @param payload - JWT payload
   * @returns Security context
   */
  buildSecurityContext(payload: JwtPayload): SecurityContext {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      realm: payload.realm,
      b2bCustomerId: payload.b2b_customer_id,
      customerId: payload.customer_id,
      permissions: payload.permissions,
      tokenId: payload.jti,
      tokenVersion: payload.version,
      isAdmin: payload.role === 'admin' || payload.role === 'superadmin',
    };
  }

  /**
   * Check if token is revoked (integration point)
   * In production, this would query a Redis cache or database
   *
   * @param payload - JWT payload
   * @returns Revocation check result
   */
  async checkTokenRevocation(payload: JwtPayload): Promise<TokenRevocationCheck> {
    // TODO: Implement actual revocation check against Redis/DB
    // For now, always return valid
    return {
      isValid: true,
    };

    // Example implementation:
    // const jti = payload.jti;
    // const userId = payload.sub;
    // const revoked = await redis.get(`revoked:${jti}`) ||
    //                 await redis.get(`user_version:${userId}`);
    //
    // if (revoked) {
    //   return {
    //     isValid: false,
    //     revocationReason: 'Token revoked by user or admin',
    //     revokedAt: new Date(),
    //   };
    // }
    //
    // // Check token version
    // if (payload.version) {
    //   const currentVersion = await db.query(
    //     'SELECT token_version FROM users WHERE id = $1',
    //     [userId]
    //   );
    //   if (currentVersion[0]?.token_version > payload.version) {
    //     return {
    //       isValid: false,
    //       revocationReason: 'Token version outdated',
    //       versionMismatch: true,
    //     };
    //   }
    // }
    //
    // return { isValid: true };
  }

  /**
   * Validate session (check expiry, activity, etc.)
   *
   * @param payload - JWT payload
   * @returns Session validation result
   */
  async validateSession(payload: JwtPayload): Promise<SessionValidationResult> {
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp) {
      return {
        isValid: false,
        invalidReason: 'Token has no expiration time',
      };
    }

    const timeRemaining = payload.exp - now;

    if (timeRemaining <= 0) {
      return {
        isValid: false,
        invalidReason: 'Session expired',
      };
    }

    return {
      isValid: true,
      expiresAt: new Date(payload.exp * 1000),
      timeRemaining,
    };
  }

  /**
   * Generate JWT token
   *
   * @param payload - Token payload
   * @param secret - Secret key (optional, uses default)
   * @param expiresIn - Expiration time (optional, uses default)
   * @returns JWT token string
   */
  generateToken(
    payload: Omit<JwtPayload, 'iat' | 'exp'>,
    secret?: string,
    expiresIn?: string | number
  ): string {
    const secretToUse = secret || this.jwtSecret;
    const tokenExpiry = (expiresIn || '1h') as SignOptions['expiresIn'];

    return jwt.sign(payload, secretToUse, {
      expiresIn: tokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
      jwtid: `${payload.sub}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  }

  /**
   * Generate refresh token
   *
   * @param payload - Token payload
   * @returns Refresh token string
   */
  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return this.generateToken(payload, this.jwtSecret, '7d');
  }

  /**
   * Normalize JWT payload to our standard format
   *
   * @param decoded - Raw decoded payload from jwt.verify
   * @returns Normalized JwtPayload
   */
  private normalizePayload(decoded: JwtLibPayload): JwtPayload {
    return {
      sub: decoded.sub || '',
      email: decoded.email || '',
      role: decoded.role || 'user',
      realm: (decoded.realm || 'erp') as 'erp' | 'b2b' | string,
      b2b_customer_id: decoded.b2b_customer_id,
      customer_id: decoded.customer_id,
      permissions: decoded.permissions as string[] | undefined,
      iat: decoded.iat,
      exp: decoded.exp,
      jti: decoded.jti,
      version: decoded.version as number | undefined,
    };
  }
}

/**
 * Custom UnauthorizedError for JWT parsing
 */
export class UnauthorizedError extends Error {
  constructor(message: string, public expiredAt?: Date) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Singleton instance getter
 */
let jwtParserInstance: JwtParser | null = null;

export function getJwtParser(config?: ConstructorParameters<typeof JwtParser>[0]): JwtParser {
  if (!jwtParserInstance && config) {
    jwtParserInstance = new JwtParser(config);
  }

  if (!jwtParserInstance) {
    throw new Error('JwtParser not initialized. Call getJwtParser(config) with config first.');
  }

  return jwtParserInstance;
}

export function setJwtParser(parser: JwtParser): void {
  jwtParserInstance = parser;
}
