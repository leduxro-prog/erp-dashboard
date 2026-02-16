import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useB2BAuthStore } from './b2b/b2b-auth.store';

export interface FavoriteItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  price: number;
  currency: string;
  image_url?: string;
  stock_available: number;
  stock_local: number;
  stock_supplier: number;
  supplier_lead_time: number;
  in_stock: boolean;
  created_at: string;
}

interface FavoritesStore {
  favorites: FavoriteItem[];
  isLoading: boolean;
  error: string | null;
  maxAllowed: number;

  fetchFavorites: () => Promise<void>;
  addFavorite: (productId: number) => Promise<{ success: boolean; alreadyFavorite?: boolean }>;
  removeFavorite: (productId: number) => Promise<boolean>;
  checkFavorite: (productId: number) => Promise<boolean>;
  addAllToCart: (quantities?: Record<string, number>) => Promise<{ added: number; issues: any[] }>;
  notifyStockBack: (productId: number) => Promise<boolean>;
  isFavorite: (productId: number) => boolean;
  clearFavorites: () => void;
}

const API_BASE = '/api/v1/b2b';

async function getAuthHeaders() {
  const { token } = useB2BAuthStore.getState();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      isLoading: false,
      error: null,
      maxAllowed: 50,

      fetchFavorites: async () => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          set({ favorites: [], isLoading: false });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE}/favorites`, {
            headers: await getAuthHeaders(),
          });
          const data = await response.json();
          if (data.success && data.data) {
            set({
              favorites: data.data.favorites || [],
              maxAllowed: data.data.max_allowed || 50,
              isLoading: false,
            });
          } else {
            set({ favorites: [], isLoading: false });
          }
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      addFavorite: async (productId: number) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return { success: false };
        }

        try {
          const response = await fetch(`${API_BASE}/favorites`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ product_id: productId }),
          });
          const data = await response.json();
          if (data.success) {
            await get().fetchFavorites();
            return { success: true, alreadyFavorite: data.data?.already_favorite };
          }
          return { success: false };
        } catch {
          return { success: false };
        }
      },

      removeFavorite: async (productId: number) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return false;
        }

        try {
          const response = await fetch(`${API_BASE}/favorites/${productId}`, {
            method: 'DELETE',
            headers: await getAuthHeaders(),
          });
          const data = await response.json();
          if (data.success) {
            set((state) => ({
              favorites: state.favorites.filter((f) => f.product_id !== productId),
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      checkFavorite: async (productId: number) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return false;
        }

        try {
          const response = await fetch(`${API_BASE}/favorites/check/${productId}`, {
            headers: await getAuthHeaders(),
          });
          const data = await response.json();
          return data.success && data.data?.is_favorite;
        } catch {
          return false;
        }
      },

      addAllToCart: async (quantities?: Record<string, number>) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return { added: 0, issues: [] };
        }

        try {
          const response = await fetch(`${API_BASE}/favorites/add-all-to-cart`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ quantities: quantities || {} }),
          });
          const data = await response.json();
          if (data.success && data.data) {
            return {
              added: data.data.total_added || 0,
              issues: data.data.stock_issues || [],
            };
          }
          return { added: 0, issues: [] };
        } catch {
          return { added: 0, issues: [] };
        }
      },

      notifyStockBack: async (productId: number) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return false;
        }

        try {
          const response = await fetch(`${API_BASE}/favorites/${productId}/notify-stock`, {
            method: 'POST',
            headers: await getAuthHeaders(),
          });
          const data = await response.json();
          return data.success;
        } catch {
          return false;
        }
      },

      isFavorite: (productId: number) => {
        return get().favorites.some((f) => f.product_id === productId);
      },

      clearFavorites: () => {
        set({ favorites: [], error: null });
      },
    }),
    {
      name: 'b2b-favorites-storage',
      partialize: (state) => ({
        favorites: state.favorites,
      }),
    }
  )
);
