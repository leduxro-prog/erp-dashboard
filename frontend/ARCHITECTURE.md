# CYPHER ERP Frontend - Architecture Documentation

## Overview

This is a complete, production-ready Enterprise Resource Planning (ERP) frontend built with modern web technologies. The application features a macOS-inspired design with glass morphism effects, dark mode support, and a comprehensive set of business modules.

## Technology Stack

### Core Framework
- **React 18.3.1** - UI framework with hooks
- **TypeScript** - Static type checking
- **Vite** - Fast build tool with HMR
- **Tailwind CSS** - Utility-first CSS framework

### State Management
- **Zustand** - Lightweight global state management
- **TanStack React Query** - Server state and caching
- **React Hook Form** - Form state management
- **Zod** - Schema validation

### UI & Visualization
- **Lucide React** - 344+ beautiful SVG icons
- **Recharts** - React components for charts
- **Framer Motion** - Animation library
- **React Hot Toast** - Toast notifications

### Routing & Navigation
- **React Router v6** - Client-side routing
- **useLocation, useNavigate** - Navigation hooks

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx          # Main layout wrapper
│   │   │   ├── Sidebar.tsx            # Collapsible navigation
│   │   │   ├── TopBar.tsx             # Header with breadcrumbs
│   │   │   └── CommandPalette.tsx     # ⌘K search overlay
│   │   └── ui/
│   │       ├── KPICard.tsx            # Metric cards with sparklines
│   │       ├── DataTable.tsx          # Sortable, paginated tables
│   │       ├── StatusBadge.tsx        # Status indicators
│   │       ├── Modal.tsx              # Dialog component
│   │       ├── Tabs.tsx               # Tab navigation
│   │       ├── Chart.tsx              # Recharts wrapper
│   │       ├── EmptyState.tsx         # Empty state UI
│   │       └── LoadingSkeleton.tsx    # Loading placeholders
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── WMSPage.tsx
│   │   ├── SuppliersPage.tsx
│   │   ├── QuotationsPage.tsx
│   │   ├── SmartBillPage.tsx
│   │   ├── WooCommercePage.tsx
│   │   ├── B2BPortalPage.tsx
│   │   ├── POSPage.tsx
│   │   ├── CRMPage.tsx
│   │   ├── MarketingPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   ├── SeoPage.tsx
│   │   ├── ConfiguratorsPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   ├── WhatsAppPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── LoginPage.tsx
│   ├── services/
│   │   ├── api.ts                     # HTTP client
│   │   ├── auth.service.ts
│   │   ├── orders.service.ts
│   │   ├── products.service.ts
│   │   ├── inventory.service.ts
│   │   ├── wms.service.ts
│   │   ├── suppliers.service.ts
│   │   ├── quotations.service.ts
│   │   ├── smartbill.service.ts
│   │   ├── woocommerce.service.ts
│   │   ├── pos.service.ts
│   │   ├── crm.service.ts
│   │   └── b2b.service.ts
│   ├── types/
│   │   ├── common.ts
│   │   ├── order.ts
│   │   ├── product.ts
│   │   ├── inventory.ts
│   │   ├── user.ts
│   │   ├── wms.ts
│   │   ├── pos.ts
│   │   ├── crm.ts
│   │   └── analytics.ts
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx                        # Route configuration
│   └── main.tsx                       # Entry point
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
└── .gitignore
```

## Design System

### Color Palette

**Light Theme:**
- Surface: `rgba(255, 255, 255, 0.72)`
- Sidebar: `rgba(246, 246, 246, 0.92)`
- Text Primary: `#1D1D1F`
- Text Secondary: `#86868B`
- Accent: `#007AFF` (iOS Blue)

**Dark Theme:**
- Surface: `rgba(30, 30, 30, 0.80)`
- Sidebar: `rgba(28, 28, 30, 0.92)`
- Text Primary: `#FFFFFF`
- Text Secondary: `#A1A1A6`
- Accent: `#0A84FF` (iOS Blue Dark)

### Accent Colors

- **Success:** `#34C759`
- **Warning:** `#FF9500`
- **Danger:** `#FF3B30`
- **Purple:** `#AF52DE`
- **Pink:** `#FF2D55`
- **Teal:** `#5AC8FA`
- **Indigo:** `#5856D6`

### Typography

- **Font Family:** System fonts with `-apple-system` fallback
- **Base Font:** SF Pro Display / Helvetica Neue
- **Mono Font:** SF Mono / Menlo

### Spacing & Sizing

- **Sidebar Width:** 260px (collapsed: 80px)
- **Top Bar Height:** 52px
- **Border Radius:** 10px (buttons), 14px (cards), 20px (modals)
- **Shadow:** Multiple levels (macos, macos-lg, macos-xl)

## Key Features

### 1. Sidebar Navigation
- Traffic light window controls (red/yellow/green dots)
- Collapsible design with smooth transitions
- Navigation grouped by category
- Active state highlighting with blue accent
- Notification badges for items with counts
- Footer showing version and copyright

### 2. Top Bar
- Dynamic breadcrumb based on current route
- Search/Command Palette trigger (⌘K)
- Theme toggle (light/dark)
- Notification bell with count badge
- User avatar with dropdown menu

### 3. Command Palette
- Spotlight-style overlay search
- Live filtering across navigation and actions
- Keyboard navigation (↑↓⏎ESC)
- Grouped results by category
- Smooth scale-in animation

### 4. Data Tables
- Column sorting with visual indicators
- Pagination and filtering
- Row selection with bulk actions toolbar
- Loading skeleton states
- Empty states with helpful messages
- Hover effects and transitions

### 5. KPI Cards
- Large metric displays with icons
- Trend indicators (% change up/down)
- Mini sparkline charts
- Color-coded status (success, warning, danger)
- Responsive grid layout

### 6. Charts
- Line charts with trend data
- Bar charts with aggregations
- Area charts for ranges
- Pie charts for distributions
- Custom tooltip styling
- Responsive containers

### 7. Forms
- React Hook Form integration
- Zod schema validation
- Input field styling
- Error messaging
- Form submission handling

## Routing Structure

```
/ (requires auth)
├── /dashboard
├── /orders
├── /products
├── /inventory
├── /wms
├── /suppliers
├── /quotations
├── /smartbill
├── /woocommerce
├── /b2b
├── /pos
├── /crm
├── /marketing
├── /analytics
├── /seo
├── /configurators
├── /notifications
├── /whatsapp
├── /settings
└── /login (public)
```

## API Integration

### API Client
The `api.ts` service provides:
- Base HTTP client with error handling
- Methods: `get()`, `post()`, `put()`, `delete()`
- Automatic JSON serialization/deserialization
- Token-based authentication ready

### Service Layer
Each module has a dedicated service:
```typescript
// Example: Orders Service
ordersService.getOrders(filters)
ordersService.getOrder(id)
ordersService.createOrder(data)
ordersService.updateOrder(id, data)
ordersService.deleteOrder(id)
```

## Type Safety

Complete TypeScript implementation with:
- Strict mode enabled
- Global type definitions in `/types`
- Service-specific types
- React component prop interfaces
- API response types

## Performance Optimizations

1. **Code Splitting** - Vite's built-in module splitting
2. **Lazy Routes** - Ready for React.lazy() implementation
3. **Memoization** - React.memo for expensive components
4. **Query Caching** - TanStack Query stale-time configuration
5. **Image Optimization** - Ready for webp/lazy loading
6. **CSS Purging** - Tailwind removes unused styles

## State Management Strategy

### Global State (Zustand)
- User authentication state
- App-wide settings (theme, language)
- UI state (sidebar open/closed)

### Server State (React Query)
- Paginated data lists
- Real-time syncing
- Cache management
- Stale data handling

### Form State (React Hook Form)
- Local form field values
- Validation errors
- Submission states

### Component State (useState)
- UI interactions (dropdowns, modals)
- Temporary values

## Authentication

The auth service provides:
```typescript
authService.login(email, password)
authService.logout()
authService.getCurrentUser()
authService.getAccessToken()
authService.isAuthenticated()
```

Tokens stored in localStorage and ready for interceptor implementation.

## Error Handling

- API errors logged to console
- User-friendly error messages via toast
- Graceful fallbacks for missing data
- Empty state guidance

## Accessibility Features

- Semantic HTML structure
- ARIA labels on buttons and icons
- Keyboard navigation in tables
- Color contrast compliance
- Focus states on interactive elements

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development Workflow

### Running Development Server
```bash
npm run dev
# Opens http://localhost:3000
```

### Building for Production
```bash
npm run build
# Output in /dist
```

### Preview Production Build
```bash
npm run preview
```

## Next Steps

### To Add Features:

1. **New Page**
   - Create component in `src/pages/`
   - Add route in `App.tsx`
   - Create service in `src/services/` if needed
   - Add type definitions in `src/types/`

2. **New API Endpoint**
   - Create service in `src/services/`
   - Add types in `src/types/`
   - Implement in page component

3. **New UI Component**
   - Create in `src/components/ui/`
   - Export from components barrel if needed
   - Document props and usage

4. **Global State**
   - Create Zustand store in `src/stores/`
   - Export hooks for consumption

## Configuration

### Environment Variables
Create `.env.local`:
```
VITE_API_URL=http://localhost:4000/api
VITE_APP_NAME=CYPHER ERP
```

### API Proxy
Configured in `vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    changeOrigin: true,
  },
}
```

## Deployment

### Build Optimization
```bash
npm run build
# Builds optimized production bundle
```

### Deployment Options
- Static hosting (Vercel, Netlify, S3)
- Docker containerization
- Traditional server (Node.js)

## Support & Documentation

- Component examples in each module
- Type definitions guide API contracts
- Service layer abstracts backend communication
- Tailwind CSS custom classes in globals.css

---

**Built with ❤️ for Ledux.ro**
