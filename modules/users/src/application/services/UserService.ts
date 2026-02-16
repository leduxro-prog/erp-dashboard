import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';

import { UserEntity, UserRole } from '../../domain/entities/UserEntity';
import { createModuleLogger } from '@shared/utils/logger';

export class UserService {
  private repository: Repository<UserEntity>;
  private logger = createModuleLogger('UserService');

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(UserEntity);
  }

  /**
   * Validate password strength requirements
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new Error(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
    }
  }

  async create(data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    role?: UserRole;
  }): Promise<UserEntity> {
    try {
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }

      // Validate password strength
      this.validatePasswordStrength(data.password);

      // Check if user exists
      const existing = await this.repository.findOne({
        where: { email: data.email },
      });

      if (existing) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const password_hash = await UserEntity.hashPassword(data.password);

      const user = this.repository.create({
        email: data.email,
        password_hash,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        role: data.role || UserRole.GUEST,
        is_active: true,
      });

      return await this.repository.save(user);
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repository.find({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repository.findOne({
      where: { email, is_active: true },
    });
  }

  async getUserWithSecrets(userId: number): Promise<UserEntity> {
    const user = await this.repository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.twofa_secret')
      .addSelect('user.twofa_backup_codes')
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    // For backward compatibility - username is actually email
    return this.findByEmail(username);
  }

  async validatePassword(userId: number, password: string): Promise<boolean> {
    const user = await this.repository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.password_hash')
      .getOne();

    if (!user) {
      return false;
    }

    return user.validatePassword(password);
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.repository.update(userId, {
      last_login_at: new Date(),
    });
  }

  /**
   * Handle failed login attempt
   * - Increments failed_login_attempts counter
   * - Locks account for 15 minutes after 5 failed attempts
   */
  async handleFailedLogin(userId: number): Promise<void> {
    const user = await this.repository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    const newFailedAttempts = user.failed_login_attempts + 1;
    const updateData: Partial<UserEntity> = {
      failed_login_attempts: newFailedAttempts,
    };

    // Lock account after 5 failed attempts (15 minutes lockout)
    if (newFailedAttempts >= 5) {
      const lockoutDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
      updateData.locked_until = new Date(Date.now() + lockoutDuration);

      this.logger.warn('Account locked due to failed login attempts', {
        userId: user.id,
        email: user.email,
        failedAttempts: newFailedAttempts,
        lockedUntil: updateData.locked_until,
      });
    }

    await this.repository.update(userId, updateData);
  }

  /**
   * Reset failed login attempts counter
   * Called on successful login
   */
  async resetFailedLoginAttempts(userId: number): Promise<void> {
    await this.repository.update(userId, {
      failed_login_attempts: 0,
      locked_until: null as any, // TypeORM allows null to clear timestamp fields
    });
  }

  async delete(id: number): Promise<void> {
    // Soft delete - just set is_active to false
    await this.repository.update(id, { is_active: false });
  }

  /**
   * Generate a password reset token for the given email.
   * Returns the plain token (to be sent via email).
   * Stores a hashed version in the database for security.
   * Token expires after 1 hour.
   */
  async generateResetToken(email: string): Promise<{ token: string; user: UserEntity } | null> {
    const user = await this.repository.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      return null;
    }

    // Generate a cryptographically secure random token
    const plainToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing (same principle as passwords)
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.repository.update(user.id, {
      reset_token: hashedToken,
      reset_token_expires_at: expiresAt,
    });

    this.logger.info('Password reset token generated', {
      userId: user.id,
      email: user.email,
      expiresAt,
    });

    return { token: plainToken, user };
  }

  /**
   * Reset the user's password using a valid reset token.
   * Validates the token, enforces password strength, then updates.
   */
  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.repository
      .createQueryBuilder('user')
      .where('user.reset_token = :hashedToken', { hashedToken })
      .andWhere('user.reset_token_expires_at > :now', { now: new Date() })
      .andWhere('user.is_active = :active', { active: true })
      .addSelect('user.reset_token')
      .getOne();

    if (!user) {
      this.logger.warn('Invalid or expired reset token used');
      return false;
    }

    // Validate password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password and clear reset token
    const password_hash = await UserEntity.hashPassword(newPassword);

    await this.repository.update(user.id, {
      password_hash,
      reset_token: null as unknown as string,
      reset_token_expires_at: null as unknown as Date,
      failed_login_attempts: 0,
      locked_until: null as unknown as Date,
    });

    this.logger.info('Password reset successfully', {
      userId: user.id,
      email: user.email,
    });

    return true;
  }
}
