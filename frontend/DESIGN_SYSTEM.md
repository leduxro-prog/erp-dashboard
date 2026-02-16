# CYPHER ERP - macOS Design System & Layout

Complete implementation of a modern macOS-style design system and layout for the CYPHER ERP frontend.

## Overview

This design system follows Apple's Human Interface Guidelines with a clean, minimal aesthetic featuring:
- Vibrancy effects and frosted glass design
- Subtle multi-layer shadows
- Smooth 0.3s transitions
- SF Pro font family stack
- Rounded corners (10px, 14px, 20px)
- Dark mode support throughout
- Blue accent color (#007AFF)

## Files Created/Updated

### 1. Global Styles
- **`src/styles/globals.css`** - Complete macOS-style global CSS
  - Tailwind base/components/utilities integration
  - CSS variables for theme colors
  - macOS scrollbar styling
  - Glass morphism utilities
  - Component-level utilities (btn-*, card, badge, etc.)
  - Dark mode support
  - Focus ring and selection styles
  - Alert and status indicator styles

### 2. Configuration Files
- **`postcss.config.js`** - PostCSS configuration with Tailwind and Autoprefixer
- **`tailwind.config.js`** - Comprehensive Tailwind configuration
  - macOS color palette (accent, success, warning, danger)
  - SF Pro Display font stack
  - Custom border radius (macos: 10px, macos-lg: 14px, macos-xl: 20px)
  - macOS shadow utilities (macos, macos-lg, macos-xl)
  - Backdrop blur effects
  - Custom animations (fade-in, slide-in, slide-up, scale-in, pulse-soft)
  - Dark mode via class

### 3. Layout Components

#### **`src/components/layout/Sidebar.tsx`**
Collapsible sidebar with:
- Frosted glass effect (backdrop-blur-mac)
- macOS traffic light dots (red, yellow, green)
- Navigation sections with icons from lucide-react
- 9 main sections:
  * PRINCIPAL: Dashboard, Comenzi, Produse, Stocuri
  * VANZARI: POS, Cotații, Portal B2B
  * ACHIZITII: Furnizori, Receptii
  * FINANCIAR: Facturi SmartBill, Rapoarte
  * MARKETING: Campanii, Coduri Discount, SEO
  * COMUNICARE: Notificări, WhatsApp
  * INTEGRARI: WooCommerce, Configuratoare
  * ANALYTICS: Dashboard Analytics, Previziuni
  * CRM: Clienti, Fidelizare, Segmente
- Active item with blue highlight pill
- Collapse/expand animation (260px → 80px)
- User avatar + name at bottom
- Version info footer
- Romanian labels throughout
- Notification badges

#### **`src/components/layout/TopBar.tsx`**
Fixed macOS-style top bar featuring:
- Frosted glass effect
- Breadcrumb navigation with dynamic routing
- Global search button (Cmd+K shortcut)
- Notification bell with badge
- Theme toggle (light/dark)
- User dropdown menu with Settings and Logout
- Dynamic width based on sidebar state
- Mobile-responsive design
- Keyboard shortcut support

#### **`src/components/layout/AppLayout.tsx`**
Main layout component combining:
- Sidebar on left (260px expanded, 80px collapsed)
- Fixed TopBar with proper z-index
- Content area with pt-[52px] padding for fixed topbar
- Command palette modal integration
- State synchronization with UI store
- Smooth transitions

#### **`src/components/layout/CommandPalette.tsx`**
macOS Spotlight-style command palette:
- Opens with Cmd+K shortcut
- Frosted glass overlay with backdrop blur
- Fuzzy search with keyword support
- 12+ commands categorized by:
  * Navigation (Dashboard, Orders, Products, etc.)
  * Actions (Create Order, Create Product, Sync, etc.)
- Keyboard navigation (↑↓ to navigate, ↵ to select, ESC to close)
- Grouped by category with section headers
- Selected item highlighting in blue
- Instructions footer with keyboard hints
- Smooth scale-in animation

### 4. Application Entry Points

#### **`src/App.tsx`**
Main application router with:
- Public route: `/login`
- Protected routes with AppLayout wrapper
- All 19 main module routes organized by function
- Catch-all redirect to dashboard
- Clean route organization by business function

#### **`src/main.tsx`**
React entry point with:
- React Router setup with BrowserRouter
- React Query configuration with sensible defaults
- React Hot Toast for notifications with custom styling
- Global CSS imports

#### **`index.html`**
HTML shell with:
- Romanian language (lang="ro")
- Dark mode default (class="dark")
- Meta tags for viewport, theme color, PWA
- Apple-specific meta tags for iOS support
- Font preconnect for performance
- Proper script module loading

### 5. State Management

#### **`src/stores/ui.store.ts`** (Zustand)
UI state management:
- **Sidebar**: `sidebarCollapsed`, `toggleSidebar()`, `setSidebarCollapsed()`
- **Theme**: `theme`, `setTheme()`, `toggleTheme()` with DOM sync
- **Command Palette**: `commandPaletteOpen`, `setCommandPaletteOpen()`, `toggleCommandPalette()`
- **Breadcrumb**: `currentBreadcrumb`, `setBreadcrumb()`
- **Mobile Menu**: `mobileMenuOpen`, `setMobileMenuOpen()`, `toggleMobileMenu()`
- **Notifications Panel**: `notificationsPanelOpen`, `setNotificationsPanelOpen()`, `toggleNotificationsPanel()`
- **Search**: `searchQuery`, `setSearchQuery()`
- Persisted to localStorage: `sidebarCollapsed`, `theme`
- Automatic dark class application to document root

#### **`src/stores/auth.store.ts`** (Zustand)
Authentication state management:
- **User Data**: `user` (User object), `isAuthenticated`, `token`, `refreshToken`
- **Loading**: `isLoading`, `error`
- **Actions**:
  * `login(email, password)` - API call to /api/auth/login
  * `logout()` - Clear all auth state
  * `setUser(user)` - Manual user set
  * `setToken(token, refreshToken?)` - Set auth tokens
  * `clearAuth()` - Clear everything
  * `setError(error)` - Error management
  * `hasPermission(permission)` - Check permission
  * `hasRole(role)` - Check user role
- User roles: admin, manager, user, supplier
- Persisted to localStorage: user, token, refreshToken
- Version control for migrations

## Design Principles

### Apple-Inspired
- Clean, minimal interface with lots of white space
- Vibrancy effects and translucency throughout
- Subtle animations (200-300ms)
- Rounded corners for friendliness
- Consistent visual hierarchy

### Color Palette
- **Accent**: #007AFF (iOS blue)
- **Success**: #34C759 (iOS green)
- **Warning**: #FF9500 (iOS orange)
- **Danger**: #FF3B30 (iOS red)
- **Text Primary**: #1D1D1F (almost black)
- **Text Secondary**: #86868B (medium gray)
- **Text Tertiary**: #AEAEB2 (light gray)

### Typography
- **Font Stack**: `-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Helvetica Neue, Arial, sans-serif`
- **Base Size**: 14px for body text
- **Heading Weights**: 600-700 for hierarchy
- **Monospace**: SF Mono for code/data

### Spacing
- Consistent 4px grid
- 16px padding for containers
- 8px gaps for components
- 4px padding for small elements

### Shadows
- `macos`: `0 0 0 0.5px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)`
- `macos-lg`: `0 0 0 0.5px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.12)`
- `macos-xl`: `0 0 0 0.5px rgba(0,0,0,0.12), 0 16px 56px rgba(0,0,0,0.16)`

### Border Radius
- **Small**: 10px (macos)
- **Medium**: 14px (macos-lg)
- **Large**: 20px (macos-xl)
- **Pill**: 999px (for badges)

### Animations
- **Default Duration**: 150-300ms
- **Easing**: ease-out, ease-in-out
- **Fade In**: 300ms
- **Slide In/Up**: 200-300ms
- **Scale In**: 200ms
- **Transitions**: Automatic on color, shadow, transform

## Usage

### Theme Toggle
```typescript
import { useUIStore } from '@stores/ui.store';

function Component() {
  const { theme, toggleTheme } = useUIStore();
  
  return <button onClick={toggleTheme}>
    {theme === 'dark' ? '☀️' : '🌙'}
  </button>;
}
```

### Sidebar State
```typescript
const { sidebarCollapsed, toggleSidebar } = useUIStore();
```

### Command Palette
```typescript
const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
```

### Authentication
```typescript
import { useAuthStore } from '@stores/auth.store';

function LoginComponent() {
  const { login, isLoading, error } = useAuthStore();
  
  const handleLogin = async (email, password) => {
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
    }
  };
}
```

## Browser Support

- **Modern Browsers**: Chrome, Safari, Firefox, Edge
- **macOS Safari**: Full support with system font integration
- **Mobile**: iOS 13+, Android 10+
- **Dark Mode**: System preference detection via `prefers-color-scheme`

## Performance Notes

- Lazy-loaded routes with React Router
- React Query for intelligent caching
- CSS animations use GPU acceleration
- Scrollbar hidden on overflow containers
- Images optimized via Vite

## Accessibility

- Focus rings on all interactive elements
- Semantic HTML structure
- ARIA labels on buttons
- Keyboard navigation support (Cmd+K, Tab)
- High contrast for dark/light modes
- Color not sole indicator of status

## Dependencies

- **React**: 18.3.1
- **React Router**: 6.22.0
- **Tailwind CSS**: 3.4.1
- **Zustand**: 4.5.0
- **React Query**: 5.17.0
- **React Hot Toast**: 2.4.1
- **Lucide React**: 0.344.0 (icons)
- **Framer Motion**: 11.0.3 (optional animations)

## Next Steps

1. Build page components in `src/pages/`
2. Create custom UI components in `src/components/ui/`
3. Implement API services in `src/services/`
4. Add custom hooks in `src/hooks/`
5. Extend stores as needed for domain state

## File Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── AppLayout.tsx
│   │   └── CommandPalette.tsx
│   └── ui/
├── pages/
├── stores/
│   ├── ui.store.ts
│   ├── auth.store.ts
│   └── notifications.store.ts
├── types/
├── services/
├── hooks/
├── styles/
│   └── globals.css
├── App.tsx
└── main.tsx
```

---

**CYPHER ERP Frontend Design System v1.0**
Ready for page implementation and feature development.
