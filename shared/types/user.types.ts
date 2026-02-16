/**
 * User management types
 */

import { BaseEntity, Language } from './common.types';

/**
 * User roles in the system
 */
export const UserRoleEnum = {
  ADMIN: 'admin',
  SALES: 'sales',
  WAREHOUSE: 'warehouse',
  FINANCE: 'finance',
  SUPPLIER_MANAGER: 'supplier_manager',
  SUPPORT: 'support',
  B2B_USER: 'b2b_user',
  GUEST: 'guest',
} as const;

export type UserRole = typeof UserRoleEnum[keyof typeof UserRoleEnum];

/**
 * Gender values
 */
export const GenderEnum = {
  MALE: 'M',
  FEMALE: 'F',
  OTHER: 'O',
  NOT_SPECIFIED: 'N/A',
} as const;

export type Gender = typeof GenderEnum[keyof typeof GenderEnum];

/**
 * Main user entity
 */
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  /** Whether user email is verified */
  emailVerified: boolean;
  /** Timestamp of last email verification */
  emailVerifiedAt?: Date | null;
  /** Whether user account is active */
  isActive: boolean;
  /** Timestamp of last login */
  lastLoginAt?: Date | null;
  /** IP address of last login */
  lastLoginIp?: string | null;
  /** User preferred language */
  preferredLanguage: Language;
  /** User avatar URL */
  avatarUrl?: string | null;
  /** Two-factor authentication enabled */
  twoFactorEnabled: boolean;
  /** JSON metadata for user preferences */
  metadata?: Record<string, unknown> | null;
}

/**
 * User device tracking for security
 */
export interface UserDevice extends BaseEntity {
  userId: number;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  operatingSystem: string;
  userAgent: string;
  ipAddress: string;
  isActive: boolean;
  lastUsedAt?: Date | null;
}

/**
 * Two-factor authentication setup
 */
export interface User2FA extends BaseEntity {
  userId: number;
  secret: string;
  /** Base32 encoded secret for QR code generation */
  secretBackupCodes: string[];
  /** Whether 2FA is verified and active */
  isVerified: boolean;
  /** Timestamp when 2FA was enabled */
  enabledAt?: Date | null;
  /** Timestamp when 2FA was disabled (if applicable) */
  disabledAt?: Date | null;
  /** Method of 2FA (authenticator app, SMS, etc.) */
  method: 'totp' | 'sms';
}

/**
 * Password reset token for account recovery
 */
export interface PasswordResetToken extends BaseEntity {
  userId: number;
  token: string;
  /** Token expiration time */
  expiresAt: Date;
  /** Whether token has been used */
  used: boolean;
  /** Timestamp when token was used */
  usedAt?: Date | null;
  /** IP address that requested the reset */
  requestedFromIp?: string | null;
}

/**
 * Data transfer object for user creation/update
 */
export interface CreateUserDTO {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: Date;
  role: UserRole;
  preferredLanguage?: Language;
  password?: string; // Only for creation
}

/**
 * Data transfer object for user update
 */
export interface UpdateUserDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: Date;
  preferredLanguage?: Language;
  avatarUrl?: string;
  role?: UserRole;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
  /** 2FA code if enabled */
  twoFactorCode?: string;
}

/**
 * Password change request
 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * User session information
 */
export interface UserSession {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: string[];
  preferredLanguage: Language;
  deviceId?: string;
}
