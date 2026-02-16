# CYPHER ERP Frontend Architecture

## Overview

This document describes the API service layer, state management, and utilities architecture for the CYPHER ERP frontend application.

## Project Structure

```
src/
├── services/              # API service layer
│   ├── api.ts            # Base API client
│   ├── auth.service.ts   # Authentication
│   ├── orders.service.ts # Order management
│   ├── products.service.ts
│   ├── inventory.service.ts
│   ├── wms.service.ts    # Warehouse management
│   ├── suppliers.service.ts
│   ├── quotations.service.ts
│   ├── smartbill.service.ts
│   ├── woocommerce.service.ts
│   ├── b2b.service.ts
│   ├── pos.service.ts    # Point of Sale
│   ├── crm.service.ts    # Customer management
│   ├── marketing.service.ts
│   ├── analytics.service.ts
│   ├── seo.service.ts
│   ├── notifications.service.ts
│   ├── whatsapp.service.ts
│   └── index.ts          # Service exports
│
├── stores/                # Zustand state management
│   ├── auth.store.ts     # Authentication state
│   ├── ui.store.ts       # UI/UX state
│   ├── notifications.store.ts
│   └── index.ts          # Store exports
│
├── hooks/                 # Custom React hooks
│   ├── useDebounce.ts
│   ├── useKeyboardShortcut.ts
│   ├── useLocalStorage.ts
│   ├── usePagination.ts
│   ├── useMediaQuery.ts
│   ├── useClickOutside.ts
│   └── index.ts          # Hook exports
│
└── types/                 # TypeScript type definitions
    ├── common.ts         # Shared types
    ├── user.ts
    ├── order.ts
    ├── product.ts
    ├── inventory.ts
    ├── wms.ts
    ├── pos.ts
    ├── crm.ts
    ├── analytics.ts
    └── index.ts          # Type exports
```

## API Client (src/services/api.ts)

### Features

- **Native Fetch Wrapper**: Uses native `fetch` API with no external HTTP library
- **JWT Token Management**: Automatic token storage/retrieval from localStorage
- **Request Interceptors**: Add auth headers and customize requests
- **Response Interceptors**: Transform responses globally
- **Error Interceptors**: Handle 401/auth errors with redirect to login
- **Type Safety**: Full TypeScript support for all HTTP methods
- **Query Parameters**: Automatic URL parameter encoding and array flattening

### Usage

```typescript
import { apiClient } from '@/services';

// GET request
const data = await apiClient.get<Order>('/orders/123');

// POST request
const newOrder = await apiClient.post<Order>('/orders', {
  customerId: '123',
  items: [...],
});

// PUT/PATCH/DELETE
await apiClient.put('/orders/123', data);
await apiClient.patch('/orders/123', { status: 'pending' });
await apiClient.delete('/orders/123');

// With query parameters
const orders = await apiClient.get<PaginatedResponse<Order>>('/orders', {
  params: {
    page: 1,
    pageSize: 10,
    status: 'pending',
  },
});
```

### Authentication

```typescript
// Token management
apiClient.setToken(accessToken, refreshToken);
const token = apiClient.getToken();
apiClient.clearToken();

// Navigation setup (in App.tsx or main component)
import { useInitializeApiClient } from '@/services';

function App() {
  useInitializeApiClient(); // Sets up navigation for 401 redirects
  // ...
}
```

## Authentication Service (src/services/auth.service.ts)

### Methods

```typescript
// Login
const authResponse = await authService.login({
  email: 'user@example.com',
  password: 'password',
});

// Register
const authResponse = await authService.register({
  email: 'user@example.com',
  password: 'password',
  firstName: 'John',
  lastName: 'Doe',
});

// Logout
await authService.logout();

// Get current user
const user = await authService.getCurrentUser();

// Refresh token
const newTokens = await authService.refreshToken();

// Change password
await authService.changePassword(currentPassword, newPassword);

// Password reset flow
await authService.requestPasswordReset(email);
await authService.resetPassword(token, newPassword);

// Email verification
await authService.verifyEmail(token);
await authService.resendVerificationEmail(email);
```

## Module Services

Each module has a dedicated service file with type-safe methods:

### Orders Service

```typescript
const orders = await ordersService.getOrders({
  page: 1,
  pageSize: 10,
  status: 'pending',
  search: 'customer name',
});

const order = await ordersService.getOrder(orderId);
const created = await ordersService.createOrder(orderData);
await ordersService.updateOrderStatus(orderId, 'shipped');
const history = await ordersService.getOrderStatusHistory(orderId);
const stats = await ordersService.getOrderStats(dateFrom, dateTo);
```

### Products Service

```typescript
const products = await productsService.getProducts({
  page: 1,
  pageSize: 20,
  category: 'electronics',
  search: 'laptop',
});

const product = await productsService.getProduct(productId);
const created = await productsService.createProduct(productData);
await productsService.bulkUpdatePrices(updates);
await productsService.importProducts(file);
const blob = await productsService.exportProducts('excel');
```

### Inventory Service

```typescript
const stockLevels = await inventoryService.getStockLevels({
  warehouseId: 'wh-1',
  page: 1,
});

const stock = await inventoryService.getProductStock(productId, warehouseId);
await inventoryService.adjustStock({
  productId,
  warehouseId,
  quantity: 10,
  reason: 'Stock adjustment',
});

const movements = await inventoryService.getMovements({
  type: 'inbound',
  dateFrom: '2024-01-01',
});

const alerts = await inventoryService.getAlerts({
  severity: 'critical',
  isResolved: false,
});
```

### WMS Service (Warehouse Management)

```typescript
const receptions = await wmsService.getReceptions();
const reception = await wmsService.createReception(receptionData);
await wmsService.confirmReception(receptionId, items);

const pickLists = await wmsService.getPickLists({ status: 'draft' });
const pickList = await wmsService.createPickList(pickListData);
await wmsService.assignPicker(pickListId, pickerId);
await wmsService.confirmPick(pickListId, itemId, quantity);

const batches = await wmsService.getBatches();
const expiringItems = await wmsService.getExpiringItems(30); // 30 days
const suggestions = await wmsService.getReorderSuggestions();
await wmsService.createPurchaseOrder(suggestionIds);

const kpis = await wmsService.getLogisticsKPIs(dateFrom, dateTo);
```

### POS Service

```typescript
const products = await posService.searchProduct('laptop');
const sale = await posService.createSale({
  customerId: 'c-123',
  items: [{productId: 'p-1', quantity: 2}],
  paymentMethod: 'cash',
});

await posService.processCashPayment(saleId, amount);
await posService.processCardPayment(paymentData);

const dailyReport = await posService.getDailyReport('2024-01-15');
const customer = await posService.lookupCustomer(phoneNumber);
await posService.addLoyaltyPoints(customerId, 100, 'sale-reference');
```

### CRM Service

```typescript
const customers = await crmService.getCustomers({
  page: 1,
  loyaltyTier: 'gold',
});

const segments = await crmService.getSegments();
await crmService.createSegment(segmentData);
await crmService.getSegmentMembers(segmentId);

const programs = await crmService.getLoyaltyPrograms();
const points = await crmService.getLoyaltyPoints(customerId);
await crmService.redeemPoints(customerId, 100);

const coupons = await crmService.getCoupons();
const result = await crmService.validateCoupon({
  code: 'SUMMER20',
  customerId,
  orderValue: 500,
});

const churnRisk = await crmService.getChurnRisk();
const behavior = await crmService.getCustomerBehavior(customerId);
const cohorts = await crmService.getCohortAnalysis(dateFrom, dateTo);
```

### Analytics Service

```typescript
const dashboards = await analyticsService.getDashboards();
const dashboard = await analyticsService.getDashboard(dashboardId);
const widget = await analyticsService.addWidget(dashboardId, widgetData);

const reports = await analyticsService.getReports();
const report = await analyticsService.generateReport(reportData);
const blob = await analyticsService.downloadReport(reportId, 'pdf');

const forecasts = await analyticsService.getForecasts();
const forecast = await analyticsService.generateForecast({
  type: 'sales',
  method: 'arima',
  periods: 12,
});

const scenarios = await analyticsService.getWhatIfScenarios();
await analyticsService.createWhatIfScenario(scenarioData);

const salesKPI = await analyticsService.getSalesKPI(dateFrom, dateTo);
const inventoryKPI = await analyticsService.getInventoryKPI();
const cashFlow = await analyticsService.getCashFlowProjection(12);
const metrics = await analyticsService.getDashboardMetrics();
```

## State Management (Zustand Stores)

### Authentication Store

```typescript
import { useAuthStore } from '@/stores';

function LoginComponent() {
  const { user, isAuthenticated, isLoading, error, login } = useAuthStore();

  const handleLogin = async (email, password) => {
    try {
      await login(email, password);
      // User is now logged in
    } catch (err) {
      // Handle error
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome {user?.email}</p>
      ) : (
        <button onClick={() => handleLogin('user@example.com', 'pass')}>
          Login
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### UI Store

```typescript
import { useUIStore } from '@/stores';

function AppLayout() {
  const {
    sidebarCollapsed,
    theme,
    toggleSidebar,
    setTheme,
    commandPaletteOpen,
    setCommandPaletteOpen,
  } = useUIStore();

  return (
    <div className={`theme-${theme}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
```

### Notifications Store

```typescript
import { useNotificationsStore } from '@/stores';

function NotificationsPanel() {
  const {
    unreadCount,
    recentNotifications,
    markAsRead,
    clearAll,
  } = useNotificationsStore();

  return (
    <div>
      <h3>Notifications ({unreadCount})</h3>
      {recentNotifications.map((n) => (
        <div key={n.id} onClick={() => markAsRead(n.id)}>
          {n.title}: {n.message}
        </div>
      ))}
      <button onClick={clearAll}>Clear All</button>
    </div>
  );
}
```

## Custom Hooks

### useDebounce

```typescript
import { useDebounce, useDebouncedCallback } from '@/hooks';

// Debounce a value
const searchTerm = 'laptop';
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  // Search API called after 500ms of inactivity
  searchProducts(debouncedSearch);
}, [debouncedSearch]);

// Debounce a callback
const debouncedSearch = useDebouncedCallback((query) => {
  searchProducts(query);
}, 500);

<input onChange={(e) => debouncedSearch(e.target.value)} />;
```

### useKeyboardShortcut

```typescript
import { useKeyboardShortcut, CommonShortcuts } from '@/hooks';

// Single shortcut
useKeyboardShortcut(CommonShortcuts.SAVE, () => {
  saveForm();
});

// Multiple shortcuts
useKeyboardShortcuts([
  { config: CommonShortcuts.SAVE, callback: saveForm },
  { config: CommonShortcuts.ESCAPE, callback: closeModal },
  { config: CommonShortcuts.COMMAND_PALETTE, callback: openCommandPalette },
]);
```

### useLocalStorage

```typescript
import { useLocalStorage, useLocalStorageObject } from '@/hooks';

// Simple value
const [token, setToken, removeToken] = useLocalStorage('auth_token', '');

// Object with bulk updates
const [preferences, updatePreferences, reset] = useLocalStorageObject(
  'user-preferences',
  { theme: 'light', language: 'en' },
);

updatePreferences({ theme: 'dark' }); // Syncs to localStorage
```

### usePagination

```typescript
import { usePagination } from '@/hooks';

const {
  page,
  pageSize,
  total,
  totalPages,
  goToPage,
  nextPage,
  prevPage,
  setPageSize,
  isFirstPage,
  isLastPage,
} = usePagination(150, 1, 10); // total, initial page, page size

// Use in API calls
const { data } = useQuery(['orders'], () =>
  ordersService.getOrders({ page, pageSize }),
);
```

### useMediaQuery

```typescript
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useCurrentBreakpoint,
  usePrefersDarkMode,
} from '@/hooks';

// Custom query
const isWide = useMediaQuery('(min-width: 1200px)');

// Convenience hooks
const isMobile = useIsMobile();
const isTablet = useIsTablet();
const isDesktop = useIsDesktop();
const breakpoint = useCurrentBreakpoint(); // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
const prefersDark = usePrefersDarkMode();

return <div>{isMobile ? <MobileNav /> : <DesktopNav />}</div>;
```

### useClickOutside

```typescript
import { useClickOutside, useClickOutsideAndEscape } from '@/hooks';

function Modal() {
  const ref = useClickOutside<HTMLDivElement>(() => {
    closeModal();
  });

  return (
    <div ref={ref} className="modal">
      Content
    </div>
  );
}

// With escape key support
const ref = useClickOutsideAndEscape<HTMLDivElement>(() => {
  closeModal();
});
```

## Type Definitions

### Common Types

```typescript
// Pagination
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  success: boolean;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Error handling
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string | string[]>;
    timestamp: string;
  };
  statusCode: number;
}
```

### Domain Types

Each domain has its own type file with models:
- `types/user.ts` - User, Role, Permission
- `types/order.ts` - Order, OrderItem, OrderStatus
- `types/product.ts` - Product, ProductCategory, PriceInfo
- `types/inventory.ts` - StockLevel, StockMovement, StockAlert
- `types/wms.ts` - Reception, PickList, Batch, SerialNumber
- `types/pos.ts` - Sale, CartItem, Payment, CashDrawer
- `types/crm.ts` - Customer, Segment, LoyaltyProgram, Coupon
- `types/analytics.ts` - Dashboard, Report, Forecast, KPI

## Best Practices

### 1. Service Layer Usage

```typescript
// Always use services, not direct API calls
import { ordersService } from '@/services';

// Good
const orders = await ordersService.getOrders({ page: 1 });

// Bad
const orders = await fetch('/api/orders?page=1').then(r => r.json());
```

### 2. Type Safety

```typescript
// Always type your data
const { data } = useQuery<PaginatedResponse<Order>>(['orders'], () =>
  ordersService.getOrders(),
);

// Use proper DTO types for POST/PUT
const order = await ordersService.createOrder({
  customerId: 'c-123',
  items: [{ productId: 'p-1', quantity: 2 }],
} as CreateOrderDTO);
```

### 3. Store Usage

```typescript
// Keep stores for global UI and auth state only
// Use React Query for server data
import { useAuthStore } from '@/stores';
import { useQuery } from '@tanstack/react-query';

function OrderList() {
  const user = useAuthStore((state) => state.user);
  const { data: orders } = useQuery(['orders'], () =>
    ordersService.getOrders(),
  );

  return <div>Orders for {user?.email}</div>;
}
```

### 4. Error Handling

```typescript
// Handle errors consistently
try {
  await ordersService.createOrder(data);
  toast.success('Order created');
} catch (error) {
  if (error instanceof ApiErrorClass) {
    toast.error(error.error.message);
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

### 5. Hooks Best Practices

```typescript
// Use hooks for common patterns
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);

const { data: results } = useQuery(
  ['search', debouncedSearch],
  () => searchProducts(debouncedSearch),
  { enabled: !!debouncedSearch },
);

// Combine multiple hooks
const isMobile = useIsMobile();
const [menuOpen, setMenuOpen] = useLocalStorage('menu-open', false);
const ref = useClickOutside(() => setMenuOpen(false));
```

## Configuration

### Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### Token Storage

By default, tokens are stored in localStorage. For production, consider using httpOnly cookies by modifying `apiClient.ts`.

## Initialization

In your main `App.tsx` or entry point:

```typescript
import { useInitializeApiClient } from '@/services';
import { useAuthStore } from '@/stores';

function App() {
  // Initialize API client with navigation
  useInitializeApiClient();

  // Check auth on mount
  const { refreshAccessToken } = useAuthStore();

  useEffect(() => {
    refreshAccessToken().catch(() => {
      // Redirect to login
    });
  }, []);

  return (
    // Your app
  );
}
```

## Summary

This architecture provides:

- **Type-safe API client** with interceptors and error handling
- **Modular services** for each domain with consistent patterns
- **Global state management** with Zustand for auth and UI
- **Reusable hooks** for common patterns
- **Full TypeScript support** across the entire layer
- **Easy testing** with injectable services
- **Scalable structure** for adding new features

All services follow REST conventions and return typed responses. The API client handles authentication, error handling, and token management automatically.
