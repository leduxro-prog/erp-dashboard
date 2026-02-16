export type Role = 'admin' | 'manager' | 'supervisor' | 'operator' | 'viewer';

export interface Permission {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  permissions: Permission[];
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  requires2FA?: boolean;
  preAuthToken?: string;
}

export interface TwoFactorLoginRequest {
  token: string;
  preAuthToken: string;
  isBackupCode?: boolean;
}

export interface TwoFactorLoginResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

export interface TwoFactorSetupResponse {
  success: boolean;
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  message: string;
  backupCodes: string[];
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}
