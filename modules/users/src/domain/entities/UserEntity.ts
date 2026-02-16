import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export enum UserRole {
  ADMIN = 'admin',
  SALES = 'sales',
  WAREHOUSE = 'warehouse',
  FINANCE = 'finance',
  SUPPLIER_MANAGER = 'supplier_manager',
  SUPPORT = 'support',
  B2B_USER = 'b2b_user',
  GUEST = 'guest',
}

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash', select: false })
  password_hash!: string;

  @Column({ name: 'first_name' })
  first_name!: string;

  @Column({ name: 'last_name' })
  last_name!: string;

  @Column({ name: 'phone_number', nullable: true })
  phone_number?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.GUEST,
  })
  role!: UserRole;

  @Column({ name: 'is_active', default: true })
  is_active!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  last_login_at?: Date;

  @Column({ name: 'email_verified', default: false })
  email_verified!: boolean;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  email_verified_at?: Date;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failed_login_attempts!: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  locked_until?: Date;

  @Column({ name: 'twofa_enabled', default: false })
  twofa_enabled!: boolean;

  @Column({ name: 'twofa_secret', nullable: true, select: false })
  twofa_secret?: string;

  @Column({ name: 'twofa_backup_codes', type: 'jsonb', nullable: true, select: false })
  twofa_backup_codes?: string[];

  @Column({ name: 'reset_token', nullable: true, select: false })
  reset_token?: string;

  @Column({ name: 'reset_token_expires_at', type: 'timestamp', nullable: true })
  reset_token_expires_at?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;

  /**
   * Validate password against stored hash
   */
  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  /**
   * Hash a plain password
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
}
