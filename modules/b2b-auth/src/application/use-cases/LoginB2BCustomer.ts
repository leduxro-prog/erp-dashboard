import { DataSource, Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { B2BAuthCredentialsEntity } from '../../infrastructure/entities/B2BAuthCredentialsEntity';
import { B2BCustomerEntity } from '../../../../b2b-portal/src/infrastructure/entities/B2BCustomerEntity';

export interface LoginB2BCustomerRequest {
  email: string;
  password: string;
}

export interface LoginB2BCustomerResponse {
  success: boolean;
  token?: string;
  refresh_token?: string;
  customer?: {
    id: string | number;
    email: string;
    customer_id: string | number;
    must_change_password: boolean;
    tier?: string;
    company_name?: string;
  };
  error?: string;
  locked_until?: Date;
}

export class LoginB2BCustomer {
  private credentialsRepository: Repository<B2BAuthCredentialsEntity>;
  private b2bCustomersRepository: Repository<B2BCustomerEntity>;

  constructor(
    private dataSource: DataSource,
    private publishEvent?: (event: string, data: unknown) => Promise<void>
  ) {
    this.credentialsRepository = dataSource.getRepository(B2BAuthCredentialsEntity);
    this.b2bCustomersRepository = dataSource.getRepository(B2BCustomerEntity);
  }

  async execute(request: LoginB2BCustomerRequest): Promise<LoginB2BCustomerResponse> {
    const { email, password } = request;

    // Find credentials by email
    const credentials = await this.credentialsRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!credentials) {
      await this.publishLoginFailedEvent(email, 'Invalid credentials');
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }

    // Check if account is locked
    if (credentials.isLocked()) {
      await this.publishLoginFailedEvent(email, 'Account locked');
      return {
        success: false,
        error: 'Account is temporarily locked due to too many failed login attempts',
        locked_until: credentials.locked_until,
      };
    }

    // Validate password
    const isValidPassword = await credentials.validatePassword(password);

    if (!isValidPassword) {
      // Increment failed attempts
      await credentials.incrementFailedAttempts();
      await this.credentialsRepository.save(credentials);

      await this.publishLoginFailedEvent(email, 'Invalid password');

      return {
        success: false,
        error: 'Invalid email or password',
        locked_until: credentials.isLocked() ? credentials.locked_until : undefined,
      };
    }

    // Fetch customer details using raw query to avoid TypeORM mapping issues
    // Note: DB uses bigint for id, but B2BCustomerEntity expects UUID string
    const customerData = await this.dataSource.query(
      `SELECT id, company_name, tier, status FROM b2b_customers WHERE id = $1`,
      [credentials.customer_id]
    );

    if (!customerData || customerData.length === 0) {
      await this.publishLoginFailedEvent(email, 'Customer not found');
      return {
        success: false,
        error: 'Customer account not found',
      };
    }

    const customer = customerData[0];

    // Check if customer is active
    if (customer.status !== 'ACTIVE') {
      await this.publishLoginFailedEvent(email, 'Customer inactive');
      return {
        success: false,
        error: 'Customer account is inactive',
      };
    }

    // Reset failed attempts on successful login
    credentials.resetFailedAttempts();
    await this.credentialsRepository.save(credentials);

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET_B2B;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET_B2B || jwtSecret;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET_B2B not configured');
    }

    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET_B2B not configured');
    }

    const tokenPayload = {
      sub: credentials.customer_id,
      email: credentials.email,
      role: 'b2b_customer',
      realm: 'b2b' as const,
      customer_id: credentials.customer_id,
      tier: customer.tier,
      company_name: customer.company_name,
    };

    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '24h',
    });

    const refreshToken = jwt.sign(
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

    // Publish successful login event
    await this.publishLoginSuccessEvent(credentials.customer_id.toString(), email);

    return {
      success: true,
      token,
      refresh_token: refreshToken,
      customer: {
        id: credentials.customer_id,
        email: credentials.email,
        customer_id: credentials.customer_id,
        must_change_password: credentials.must_change_password,
        tier: customer.tier,
        company_name: customer.company_name,
      },
    };
  }

  private async publishLoginSuccessEvent(customerId: string, email: string): Promise<void> {
    if (this.publishEvent) {
      await this.publishEvent('b2b-auth.login_successful', {
        customer_id: customerId,
        email,
        timestamp: new Date(),
      });
    }
  }

  private async publishLoginFailedEvent(email: string, reason: string): Promise<void> {
    if (this.publishEvent) {
      await this.publishEvent('b2b-auth.login_failed', {
        email,
        reason,
        timestamp: new Date(),
      });
    }
  }
}
