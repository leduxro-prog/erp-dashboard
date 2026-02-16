import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { b2bApi, CartItem, CartData } from '../services/b2b-api';
import { useB2BAuthStore } from './b2b/b2b-auth.store';

export interface LocalCartItem {
  id: string;
  productId: number;
  sku: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  image_url?: string;
  stock_available?: number;
}

interface CartStore {
  items: LocalCartItem[];
  serverCart: CartData | null;
  isLoading: boolean;
  error: string | null;
  tier: string;
  discountPercent: number;

  addItem: (product: Omit<LocalCartItem, 'id' | 'quantity'>, quantity?: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDiscount: () => number;
  getSubtotalWithDiscount: () => number;
  getTax: () => number;
  getTotal: () => number;
}

const TIER_DISCOUNTS: Record<string, number> = {
  STANDARD: 0,
  SILVER: 0.05,
  GOLD: 0.10,
  PLATINUM: 0.15,
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      serverCart: null,
      isLoading: false,
      error: null,
      tier: 'STANDARD',
      discountPercent: 0,

      syncWithServer: async () => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;
        if (!isAuthenticated) {
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const cartData = await b2bApi.getCart();
          const tier = cartData.tier || 'STANDARD';
          const discountPercent = TIER_DISCOUNTS[tier] || 0;

          const localItems: LocalCartItem[] = cartData.items.map((item: CartItem) => ({
            id: item.id,
            productId: parseInt(item.product_id) || 0,
            sku: item.sku,
            name: item.product_name,
            price: item.unit_price,
            currency: cartData.currency || 'RON',
            quantity: item.quantity,
            image_url: item.image_url,
            stock_available: item.stock_available,
          }));

          set({
            items: localItems,
            serverCart: cartData,
            tier,
            discountPercent,
            isLoading: false,
          });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      addItem: async (product, quantity = 1) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            await b2bApi.addToCart(String(product.productId), quantity);
            await get().syncWithServer();
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
          }
        } else {
          set((state) => {
            const existingItem = state.items.find((item) => item.productId === product.productId);

            if (existingItem) {
              return {
                items: state.items.map((item) =>
                  item.productId === product.productId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                ),
              };
            }

            return {
              items: [
                ...state.items,
                {
                  ...product,
                  id: `cart-${Date.now()}-${product.productId}`,
                  quantity,
                },
              ],
            };
          });
        }
      },

      removeItem: async (productId) => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;

        if (isAuthenticated) {
          const item = get().items.find((i) => i.productId === productId);
          if (item) {
            set({ isLoading: true, error: null });
            try {
              await b2bApi.removeCartItem(item.id);
              await get().syncWithServer();
            } catch (error: any) {
              set({ error: error.message, isLoading: false });
            }
          }
        } else {
          set((state) => ({
            items: state.items.filter((item) => item.productId !== productId),
          }));
        }
      },

      updateQuantity: async (productId, quantity) => {
        if (quantity <= 0) {
          await get().removeItem(productId);
          return;
        }

        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;

        if (isAuthenticated) {
          const item = get().items.find((i) => i.productId === productId);
          if (item) {
            set({ isLoading: true, error: null });
            try {
              await b2bApi.updateCartItem(item.id, quantity);
              await get().syncWithServer();
            } catch (error: any) {
              set({ error: error.message, isLoading: false });
            }
          }
        } else {
          set((state) => ({
            items: state.items.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          }));
        }
      },

      clearCart: async () => {
        const isAuthenticated = useB2BAuthStore.getState().isAuthenticated;

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            await b2bApi.clearCart();
            await get().syncWithServer();
          } catch (error: any) {
            set({ error: error.message, isLoading: false });
          }
        } else {
          set({ items: [] });
        }
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        const tier = get().tier;
        const discount = TIER_DISCOUNTS[tier] || 0;
        return get().items.reduce((total, item) => {
          const basePrice = item.price / (1 - discount);
          return total + basePrice * item.quantity;
        }, 0);
      },

      getDiscount: () => {
        const tier = get().tier;
        const discount = TIER_DISCOUNTS[tier] || 0;
        return get().items.reduce((total, item) => {
          const basePrice = item.price / (1 - discount);
          const discountAmount = basePrice * discount;
          return total + discountAmount * item.quantity;
        }, 0);
      },

      getSubtotalWithDiscount: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      getTax: () => {
        return get().getSubtotalWithDiscount() * 0.21;
      },

      getTotal: () => {
        return get().getSubtotalWithDiscount() + get().getTax();
      },
    }),
    {
      name: 'b2b-cart-storage',
    }
  )
);
