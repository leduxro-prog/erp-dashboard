import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { B2BAuthCredentialsEntity } from '../../infrastructure/entities/B2BAuthCredentialsEntity';

export interface ResetB2BPasswordRequest {
  token: string;
  password: string;
}

export interface ResetB2BPasswordResponse {
  success: boolean;
  error?: string;
}

export class ResetB2BPassword {
  private credentialsRepository: Repository<B2BAuthCredentialsEntity>;

  constructor(private dataSource: DataSource) {
    this.credentialsRepository = dataSource.getRepository(B2BAuthCredentialsEntity);
  }

  private validatePasswordStrength(password: string): string | null {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    return null;
  }

  async execute(request: ResetB2BPasswordRequest): Promise<ResetB2BPasswordResponse> {
    const passwordError = this.validatePasswordStrength(request.password);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    const hashedToken = crypto.createHash('sha256').update(request.token).digest('hex');

    const credentials = await this.credentialsRepository
      .createQueryBuilder('credentials')
      .where('credentials.reset_token = :hashedToken', { hashedToken })
      .andWhere('credentials.reset_token_expires_at > :now', { now: new Date() })
      .addSelect('credentials.reset_token')
      .getOne();

    if (!credentials) {
      return {
        success: false,
        error: 'Invalid or expired reset token. Please request a new password reset.',
      };
    }

    const passwordHash = await B2BAuthCredentialsEntity.hashPassword(request.password);

    await this.credentialsRepository.update(credentials.id, {
      password_hash: passwordHash,
      must_change_password: false,
      failed_login_attempts: 0,
      locked_until: null as unknown as Date,
      reset_token: null as unknown as string,
      reset_token_expires_at: null as unknown as Date,
    });

    return { success: true };
  }
}
