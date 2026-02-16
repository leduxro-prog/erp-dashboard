const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Check if user is authenticated via the non-HttpOnly auth_status cookie.
 * This cookie is set by the backend alongside the HttpOnly token cookies.
 */
function hasAuthCookie(): boolean {
  return document.cookie.split(';').some((c) => c.trim().startsWith('auth_status='));
}

interface RequestConfig {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retryCount?: number;
  params?: Record<string, unknown>;
}

class ApiClient {
  private baseUrl = API_BASE;

  /** Public accessor for the base URL (used by raw fetch calls e.g. PDF download). */
  get baseURL(): string {
    return this.baseUrl;
  }
  private tokenRefreshPromise: Promise<string | null> | null = null;

  /**
   * Returns a locally stored token (legacy) or null.
   * With HttpOnly cookies the token is sent automatically by the browser,
   * so this may return null even when the user is authenticated.
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string, refreshToken: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Returns true if the user appears to be authenticated,
   * either via the auth_status cookie or a localStorage token.
   */
  isAuthenticated(): boolean {
    return hasAuthCookie() || !!this.getToken();
  }

  private getAuthHeaders(): Record<string, string> {
    // Keep sending Authorization header for backwards compatibility
    // (the backend accepts both cookies and headers)
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Refresh the access token.
   * Tries the cookie-based /auth/refresh endpoint first.
   * Falls back to sending the refresh token from localStorage in the body.
   */
  private async refreshAccessToken(): Promise<string | null> {
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = (async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      // If no localStorage refresh token and no auth cookie, bail out
      if (!refreshToken && !hasAuthCookie()) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Send HttpOnly cookies
        // Send body for backwards compatibility (backend accepts both)
        body: refreshToken ? JSON.stringify({ refreshToken }) : '{}',
      });

      if (!response.ok) {
        this.clearToken();
        // Context-aware redirect: B2B users go to B2B login, ERP users go to ERP login.
        // Use includes() instead of startsWith() to also support deployments under path prefixes
        // (e.g. /erp/b2b-store) and legacy checkout URLs.
        const currentPath = window.location.pathname.toLowerCase();
        const isB2BRoute =
          currentPath.includes('/b2b-store') ||
          currentPath.includes('/b2b-portal') ||
          currentPath.includes('/b2b/') ||
          currentPath === '/b2b' ||
          currentPath === '/checkout' ||
          currentPath.startsWith('/checkout/');

        window.location.href = isB2BRoute ? '/b2b-store/login' : '/login';
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // If tokens are returned in the body, store them (backwards compat)
      if (data.token && data.refreshToken) {
        this.setToken(data.token, data.refreshToken);
      }

      // Return the new access token (may be null if using cookies only)
      return data.token || null;
    })();

    try {
      return await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Logout: clear cookies via backend endpoint, then clear localStorage.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best-effort; clear local state regardless
    }
    this.clearToken();
  }

  private buildUrl(url: string, params?: Record<string, unknown>): string {
    if (!params) {
      return `${this.baseUrl}${url}`;
    }

    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== '') {
            searchParams.append(key, String(item));
          }
        });
        return;
      }

      searchParams.append(key, String(value));
    });

    const query = searchParams.toString();
    if (!query) {
      return `${this.baseUrl}${url}`;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${this.baseUrl}${url}${separator}${query}`;
  }

  private async request<T = any>(
    url: string,
    method: string = 'GET',
    body?: unknown,
    config: RequestConfig = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...config.headers,
    };

    const requestInit: RequestInit = {
      method,
      headers,
      credentials: 'include', // Always send HttpOnly cookies
      signal: config.signal,
    };

    if (body) {
      requestInit.body = JSON.stringify(body);
    }

    const fullUrl = this.buildUrl(url, config.params);

    let response = await fetch(fullUrl, requestInit);

    if (response.status === 401) {
      try {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
        }
        response = await fetch(fullUrl, {
          ...requestInit,
          headers,
        });
      } catch (error) {
        throw new Error('Authentication failed');
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'GET', undefined, config);
  }

  async post<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'POST', body, config);
  }

  async put<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'PUT', body, config);
  }

  async patch<T = any>(url: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'PATCH', body, config);
  }

  async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, 'DELETE', undefined, config);
  }
}

export const apiClient = new ApiClient();

export default apiClient;
