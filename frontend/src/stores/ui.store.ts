/**
 * UI State Store (Zustand)
 * Manages all UI state including theme, sidebar, modals, etc.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export enum ThemeVariant {
  VENTURA_DARK = 'VENTURA_DARK',
  SONOMA_LIGHT = 'SONOMA_LIGHT',
  MONTEREY_PRO = 'MONTEREY_PRO',
}

interface Breadcrumb {
  label: string;
  path?: string;
}

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Theme state (basic)
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Theme variant (premium themes)
  themeVariant: ThemeVariant;
  setThemeVariant: (variant: ThemeVariant) => void;

  // AI Assistant state
  isAIAssistantOpen: boolean;
  setAIAssistantOpen: (open: boolean) => void;
  toggleAIAssistant: () => void;

  // Command palette state
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // Breadcrumb state
  currentBreadcrumb: Breadcrumb[];
  setBreadcrumb: (breadcrumb: Breadcrumb[]) => void;

  // Mobile menu state
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  // Notifications panel state
  notificationsPanelOpen: boolean;
  setNotificationsPanelOpen: (open: boolean) => void;
  toggleNotificationsPanel: () => void;

  // Search query
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Theme (basic)
      theme: 'dark',
      setTheme: (theme: 'light' | 'dark') => {
        set({ theme });
        // Apply to document
        const htmlElement = document.documentElement;
        if (theme === 'dark') {
          htmlElement.classList.add('dark');
        } else {
          htmlElement.classList.remove('dark');
        }
      },
      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          const htmlElement = document.documentElement;
          if (newTheme === 'dark') {
            htmlElement.classList.add('dark');
          } else {
            htmlElement.classList.remove('dark');
          }
          return { theme: newTheme };
        });
      },

      // Theme Variant (premium)
      themeVariant: ThemeVariant.VENTURA_DARK,
      setThemeVariant: (variant: ThemeVariant) => set({ themeVariant: variant }),

      // AI Assistant
      isAIAssistantOpen: false,
      setAIAssistantOpen: (open: boolean) => set({ isAIAssistantOpen: open }),
      toggleAIAssistant: () => set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

      // Breadcrumb
      currentBreadcrumb: [],
      setBreadcrumb: (breadcrumb: Breadcrumb[]) => set({ currentBreadcrumb: breadcrumb }),

      // Mobile menu
      mobileMenuOpen: false,
      setMobileMenuOpen: (open: boolean) => set({ mobileMenuOpen: open }),
      toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

      // Notifications panel
      notificationsPanelOpen: false,
      setNotificationsPanelOpen: (open: boolean) => set({ notificationsPanelOpen: open }),
      toggleNotificationsPanel: () => set((state) => ({ notificationsPanelOpen: !state.notificationsPanelOpen })),

      // Search query
      searchQuery: '',
      setSearchQuery: (query: string) => set({ searchQuery: query }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        themeVariant: state.themeVariant,
        isAIAssistantOpen: state.isAIAssistantOpen,
      }),
      version: 2,
    },
  ),
);
