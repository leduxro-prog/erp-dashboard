import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { B2BAuthCredentialsEntity } from '../../infrastructure/entities/B2BAuthCredentialsEntity';
import { B2BCustomerEntity } from '../../../../b2b-portal/src/infrastructure/entities/B2BCustomerEntity';

export interface RefreshB2BTokenRequest {
  refresh_token: string;
}

export interface RefreshB2BTokenResponse {
  success: boolean;
  token?: string;
  refresh_token?: string;
  error?: string;
}

interface RefreshTokenPayload {
  sub: number;
  email: string;
  realm: string;
  iat?: number;
  exp?: number;
}

export class RefreshB2BToken {
  private credentialsRepository: Repository<B2BAuthCredentialsEntity>;
  private b2bCustomersRepository: Repository<B2BCustomerEntity>;

  constructor(
    private dataSource: DataSource,
    private publishEvent?: (event: string, data: unknown) => Promise<void>
  ) {
    this.credentialsRepository = dataSource.getRepository(B2BAuthCredentialsEntity);
    this.b2bCustomersRepository = dataSource.getRepository(B2BCustomerEntity);
  }

  async execute(request: RefreshB2BTokenRequest): Promise<RefreshB2BTokenResponse> {
    const { refresh_token } = request;

    const jwtSecret = process.env.JWT_SECRET_B2B;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET_B2B || jwtSecret;

    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error('JWT secrets not configured');
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refresh_token, jwtRefreshSecret) as unknown as RefreshTokenPayload;

      // CRITICAL: Verify realm is 'b2b'
      if (decoded.realm !== 'b2b') {
        return {
          success: false,
          error: 'Invalid token realm',
        };
      }

      // Fetch credentials first (decoded.sub is customer_id as number)
      const credentials = await this.credentialsRepository.findOne({
        where: { customer_id: decoded.sub },
      });

      if (!credentials) {
        return {
          success: false,
          error: 'Authentication credentials not found',
        };
      }

      // Fetch customer using raw query
      const customerData = await this.dataSource.query(
        `SELECT id, company_name, tier, status FROM b2b_customers WHERE id = $1`,
        [credentials.customer_id]
      );

      if (!customerData || customerData.length === 0 || customerData[0].status !== 'ACTIVE') {
        return {
          success: false,
          error: 'Customer account not found or inactive',
        };
      }

      const customer = customerData[0];

      // Check if account is locked
      if (credentials.isLocked()) {
        return {
          success: false,
          error: 'Account is temporarily locked',
        };
      }

      // Generate new access token
      const tokenPayload = {
        sub: credentials.customer_id,
        email: credentials.email,
        role: 'b2b_customer',
        realm: 'b2b' as const,
        customer_id: credentials.customer_id,
        tier: customer.tier,
        company_name: customer.company_name,
      };

      const newToken = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: '24h',
      });

      // Generate new refresh token
      const newRefreshToken = jwt.sign(
        {
          sub: credentials.customer_id,
          email: credentials.email,
          realm: 'b2b' as const,
        },
        jwtRefreshSecret,
        {
          expiresIn: '7d',
        }
      );

      // Publish token refresh event
      if (this.publishEvent) {
        await this.publishEvent('b2b-auth.token_refreshed', {
          customer_id: credentials.customer_id.toString(),
          email: credentials.email,
          timestamp: new Date(),
        });
      }

      return {
        success: true,
        token: newToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          success: false,
          error: 'Refresh token expired',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      }

      console.error('Token refresh error:', error);
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }
  }
}
