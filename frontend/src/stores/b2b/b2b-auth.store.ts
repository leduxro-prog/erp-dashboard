import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface B2BCustomer {
  id: number;
  email: string;
  customer_id: number;
  must_change_password: boolean;
  tier: string;
  company_name: string;
}

interface B2BAuthState {
  token: string | null;
  refreshToken: string | null;
  customer: B2BCustomer | null;
  isAuthenticated: boolean;

  login: (token: string, refreshToken: string, customer: B2BCustomer) => void;
  logout: () => void;
  updateCustomer: (customer: B2BCustomer) => void;
}

export const useB2BAuthStore = create<B2BAuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      customer: null,
      isAuthenticated: false,

      login: (token, refreshToken, customer) =>
        set({
          token,
          refreshToken,
          customer,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          customer: null,
          isAuthenticated: false,
        }),

      updateCustomer: (customer) =>
        set({ customer }),
    }),
    {
      name: 'b2b-auth-storage',
    }
  )
);
