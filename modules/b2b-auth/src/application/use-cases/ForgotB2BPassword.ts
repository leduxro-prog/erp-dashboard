import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { B2BAuthCredentialsEntity } from '../../infrastructure/entities/B2BAuthCredentialsEntity';

export interface ForgotB2BPasswordRequest {
  email: string;
}

export interface ForgotB2BPasswordResponse {
  success: boolean;
  emailRegistered: boolean;
  token?: string;
  email?: string;
  customerName?: string;
}

export class ForgotB2BPassword {
  private credentialsRepository: Repository<B2BAuthCredentialsEntity>;

  constructor(private dataSource: DataSource) {
    this.credentialsRepository = dataSource.getRepository(B2BAuthCredentialsEntity);
  }

  async execute(request: ForgotB2BPasswordRequest): Promise<ForgotB2BPasswordResponse> {
    const email = request.email.trim().toLowerCase();

    const credentials = await this.credentialsRepository.findOne({
      where: { email },
    });

    if (!credentials) {
      return {
        success: false,
        emailRegistered: false,
      };
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.credentialsRepository.update(credentials.id, {
      reset_token: hashedToken,
      reset_token_expires_at: expiresAt,
    });

    let customerName = 'Client B2B';
    const customerData = await this.dataSource.query(
      'SELECT company_name FROM b2b_customers WHERE id = $1 LIMIT 1',
      [credentials.customer_id],
    );

    if (Array.isArray(customerData) && customerData.length > 0 && customerData[0]?.company_name) {
      customerName = customerData[0].company_name;
    }

    return {
      success: true,
      emailRegistered: true,
      token: plainToken,
      email,
      customerName,
    };
  }
}
