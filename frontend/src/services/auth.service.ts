import { apiClient } from './api';
import {
  User,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  TwoFactorLoginRequest,
  TwoFactorLoginResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from '../types/user';
import { useAuthStore } from '../stores/auth.store';

/**
 * Map the backend user object (first_name/last_name) to the frontend User shape.
 */
function mapBackendUser(backendUser: any): void {
  if (!backendUser) return;
  const name =
    [backendUser.first_name, backendUser.last_name].filter(Boolean).join(' ') ||
    backendUser.name ||
    backendUser.email ||
    'User';
  const role = backendUser.role || 'user';

  useAuthStore.getState().setUser({
    id: String(backendUser.id),
    email: backendUser.email,
    name,
    avatar: backendUser.avatar_url ?? backendUser.avatar,
    role,
    permissions: backendUser.permissions || [],
  });
}

class AuthService {
  async login(credentials: LoginRequest, remember = true): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/users/login', {
      ...credentials,
      rememberMe: remember,
    });
    if (response.token && response.refreshToken) {
      apiClient.setToken(response.token, response.refreshToken, remember);
      mapBackendUser((response as any).user);
    }
    return response;
  }

  async loginWithGoogle(credential: string, remember = true): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/users/auth/google', {
      credential,
      rememberMe: remember,
    });
    if (response.token && response.refreshToken) {
      apiClient.setToken(response.token, response.refreshToken, remember);
      mapBackendUser((response as any).user);
    }
    return response;
  }

  async verify2FA(data: TwoFactorLoginRequest, remember = true): Promise<TwoFactorLoginResponse> {
    const response = await apiClient.post<TwoFactorLoginResponse>('/users/2fa/verify', {
      ...data,
      rememberMe: remember,
    });
    if (response.token && response.refreshToken) {
      apiClient.setToken(response.token, response.refreshToken, remember);
      mapBackendUser((response as any).user);
    }
    return response;
  }

  async setup2FA(): Promise<TwoFactorSetupResponse> {
    return apiClient.post<TwoFactorSetupResponse>('/users/2fa/setup');
  }

  async verifySetup2FA(token: string, secret: string): Promise<TwoFactorVerifyResponse> {
    return apiClient.post<TwoFactorVerifyResponse>('/users/2fa/verify-setup', { token, secret });
  }

  async disable2FA(token: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/users/2fa/disable', { token });
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      apiClient.clearToken();
    }
  }

  async refresh(): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>('/auth/refresh', {});
    apiClient.setToken(response.token, response.refreshToken);
    return response;
  }

  async getProfile(): Promise<User> {
    return apiClient.get<User>('/auth/profile');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.patch<User>('/auth/profile', data);
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string; emailRegistered?: boolean }> {
    return apiClient.post('/users/forgot-password', { email });
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/users/reset-password', { token, password });
  }

  isAuthenticated(): boolean {
    return !!apiClient.getToken();
  }
}

export const authService = new AuthService();

export default authService;
