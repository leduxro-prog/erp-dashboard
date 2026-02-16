/**
 * Authentication State Store (Zustand)
 * Manages user authentication and authorization
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'user' | 'supplier';
  permissions: string[];
}

interface AuthState {
  // Authentication
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string, refreshToken?: string) => void;
  clearAuth: () => void;
  setError: (error: string | null) => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual API call
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            throw new Error('Login failed');
          }

          const data = await response.json();
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            avatar: data.user.avatar,
            role: data.user.role,
            permissions: data.user.permissions || [],
          };

          set({
            isAuthenticated: true,
            user,
            token: data.token,
            refreshToken: data.refreshToken,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          error: null,
        });
        // Clear from localStorage
        localStorage.removeItem('auth-storage');
      },

      // Set user
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      // Set token
      setToken: (token: string, refreshToken?: string) => {
        set({
          token,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
        });
      },

      // Clear auth
      clearAuth: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          error: null,
        });
      },

      // Set error
      setError: (error: string | null) => {
        set({ error });
      },

      // Check permission
      hasPermission: (permission: string) => {
        const { user } = get();
        return user?.permissions.includes(permission) || false;
      },

      // Check role
      hasRole: (role: string) => {
        const { user } = get();
        return user?.role === role || false;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      version: 1,
    },
  ),
);
