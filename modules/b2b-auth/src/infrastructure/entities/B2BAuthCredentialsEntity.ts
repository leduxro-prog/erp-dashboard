import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

@Entity('b2b_auth_credentials')
@Index('idx_b2b_auth_email', ['email'])
@Index('idx_b2b_auth_customer', ['customer_id'])
export class B2BAuthCredentialsEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'customer_id', type: 'bigint' })
  customer_id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  password_hash!: string;

  @Column({ name: 'must_change_password', default: false })
  must_change_password!: boolean;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failed_login_attempts!: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  locked_until?: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  last_login_at?: Date;

  @Column({ name: 'reset_token', nullable: true, select: false })
  reset_token?: string;

  @Column({ name: 'reset_token_expires_at', type: 'timestamp', nullable: true })
  reset_token_expires_at?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /**
   * Hash a plain password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Validate password against stored hash
   */
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  /**
   * Check if account is locked
   */
  isLocked(): boolean {
    if (!this.locked_until) return false;
    return new Date() < new Date(this.locked_until);
  }

  /**
   * Increment failed login attempts and lock if threshold reached
   */
  async incrementFailedAttempts(): Promise<void> {
    this.failed_login_attempts += 1;

    // Lock account for 15 minutes after 5 failed attempts
    if (this.failed_login_attempts >= 5) {
      const lockDuration = 15 * 60 * 1000; // 15 minutes
      this.locked_until = new Date(Date.now() + lockDuration);
    }
  }

  /**
   * Reset failed login attempts on successful login
   */
  resetFailedAttempts(): void {
    this.failed_login_attempts = 0;
    this.locked_until = undefined;
    this.last_login_at = new Date();
  }
}
