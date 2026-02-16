# CYPHER ERP Frontend

A comprehensive React/TypeScript frontend for the CYPHER ERP system with macOS-style UI components, complete API service layer, and production-ready configuration.

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable macOS-style UI components
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Select.tsx
│   │   ├── Tabs.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Avatar.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── StatusDot.tsx
│   │   ├── KPICard.tsx
│   │   └── index.ts
│   └── charts/          # Chart components (Recharts)
│       ├── AreaChart.tsx
│       ├── BarChart.tsx
│       ├── PieChart.tsx
│       ├── LineChart.tsx
│       └── index.ts
├── services/            # API service layer
│   ├── api.ts           # Base API client with auth & token refresh
│   ├── auth.service.ts
│   ├── products.service.ts
│   ├── orders.service.ts
│   ├── inventory.service.ts
│   ├── pos.service.ts
│   ├── crm.service.ts
│   ├── analytics.service.ts
│   ├── wms.service.ts
│   └── index.ts
├── types/               # TypeScript type definitions
│   ├── common.ts
│   ├── user.ts
│   ├── product.ts
│   ├── order.ts
│   ├── inventory.ts
│   ├── pos.ts
│   ├── crm.ts
│   ├── analytics.ts
│   └── index.ts
├── hooks/               # Custom React hooks
│   ├── useDebounce.ts
│   ├── useKeyboardShortcut.ts
│   ├── useLocalStorage.ts
│   ├── usePagination.ts
│   ├── useClickOutside.ts
│   ├── useMediaQuery.ts
│   └── index.ts
└── styles/
    └── globals.css      # Global styles with Tailwind

public/                 # Static assets
vite.config.ts          # Vite configuration
tailwind.config.js      # Tailwind CSS configuration
tsconfig.json           # TypeScript configuration
package.json            # Project dependencies
.env.example            # Environment variables template
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from template:
```bash
cp .env.example .env
```

3. Update `.env` with your API endpoint:
```
VITE_API_URL=http://localhost:8000/api/v1
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## UI Components

### Card
```tsx
import { Card } from '@/components/ui';

<Card 
  title="Orders" 
  subtitle="Monthly overview"
  icon={<ShoppingBag />}
  padding="md"
>
  Content here
</Card>
```

### Button
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" loading={false} icon={<Save />}>
  Save Changes
</Button>
```

### Input
```tsx
import { Input } from '@/components/ui';

<Input 
  label="Email"
  placeholder="user@example.com"
  error="Invalid email"
  variant="default"
/>
```

### Table
```tsx
import { Table } from '@/components/ui';

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
];

<Table
  columns={columns}
  data={data}
  keyExtractor={(row, idx) => row.id || idx}
  selectable={true}
  pagination={{
    page: 1,
    limit: 10,
    total: 100,
    onPageChange: (page) => setPage(page)
  }}
/>
```

### Modal
```tsx
import { Modal, Button } from '@/components/ui';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="md"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
    </>
  }
>
  Are you sure?
</Modal>
```

### Charts
```tsx
import { AreaChart, BarChart, LineChart, PieChart } from '@/components/charts';

<AreaChart
  data={chartData}
  dataKey="value"
  xAxisKey="date"
  title="Sales Trend"
  height={300}
  gradient={true}
/>
```

## API Services

All services use the centralized `apiClient` with automatic JWT token management and refresh.

### Authentication
```tsx
import { authService } from '@/services';

// Login
const response = await authService.login({ 
  email: 'user@example.com', 
  password: 'password' 
});

// Get profile
const user = await authService.getProfile();

// Logout
await authService.logout();
```

### Products
```tsx
import { productsService } from '@/services';

// Get paginated products
const products = await productsService.getProducts({ 
  page: 1, 
  limit: 10,
  sortBy: 'name'
});

// Search
const results = await productsService.searchProducts('laptop');

// CRUD operations
const product = await productsService.createProduct(data);
await productsService.updateProduct({ id: '123', name: 'New Name' });
await productsService.deleteProduct('123');
```

### Orders
```tsx
import { ordersService } from '@/services';

const orders = await ordersService.getOrders({ page: 1, limit: 20 });
const order = await ordersService.getOrderById('order-id');
await ordersService.updateOrderStatus('order-id', OrderStatus.SHIPPED);
```

### Inventory
```tsx
import { inventoryService } from '@/services';

const stocks = await inventoryService.getStockLevels();
const alerts = await inventoryService.getStockAlerts();
await inventoryService.createStockMovement({
  productId: '123',
  warehouseId: 'main',
  type: StockMovementType.IN,
  quantity: 50
});
```

### POS
```tsx
import { posService } from '@/services';

const sale = await posService.createSale({
  items: cartItems,
  subtotal: 100,
  tax: 10,
  total: 110,
  payments: [{ method: PaymentMethod.CASH, amount: 110 }]
});

const report = await posService.getDailyReport('2024-01-15');
```

### CRM
```tsx
import { crmService } from '@/services';

const customers = await crmService.getCustomers();
const balance = await crmService.getLoyaltyBalance('customer-id');
await crmService.earnLoyaltyPoints('customer-id', { saleId: 'sale-123', points: 100 });
```

### Analytics
```tsx
import { analyticsService } from '@/services';

const dashboards = await analyticsService.getDashboards();
const kpis = await analyticsService.getKPIs();
const forecast = await analyticsService.generateForecast('sales', 12);
```

### WMS
```tsx
import { wmsService } from '@/services';

const receptions = await wmsService.getReceptions();
const batches = await wmsService.getBatches();
const suggestions = await wmsService.getReorderSuggestions();
```

## Custom Hooks

### useDebounce
```tsx
import { useDebounce } from '@/hooks';

const debouncedValue = useDebounce(searchTerm, 500);
```

### useLocalStorage
```tsx
import { useLocalStorage } from '@/hooks';

const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### usePagination
```tsx
import { usePagination } from '@/hooks';

const { page, limit, goToPage, setLimit } = usePagination({
  initialPage: 1,
  initialLimit: 10
});
```

### useClickOutside
```tsx
import { useClickOutside } from '@/hooks';

const ref = useClickOutside(() => setOpen(false));
<div ref={ref}>Content</div>
```

### useMediaQuery
```tsx
import { useMediaQuery } from '@/hooks';

const isMobile = useMediaQuery('(max-width: 768px)');
```

### useKeyboardShortcut
```tsx
import { useKeyboardShortcut } from '@/hooks';

useKeyboardShortcut('s', handleSave, { ctrlKey: true });
```

## Type Definitions

All types are exported from `@/types`:

```tsx
import { 
  Order, 
  OrderStatus, 
  Product, 
  Customer, 
  PaginatedResponse,
  ApiError 
} from '@/types';
```

## Configuration

### Environment Variables
- `VITE_API_URL`: API base URL (default: `/api/v1`)
- `VITE_APP_NAME`: Application name
- `VITE_APP_VERSION`: Application version

### Tailwind CSS
Tailwind CSS is pre-configured with custom colors and animations. Extend in `tailwind.config.js`.

### Vite
Configured with React plugin and path alias `@` for `src/`.

## Features

- **macOS-style UI components** with frosted glass effect
- **Complete API service layer** with JWT token management
- **Type-safe** with full TypeScript support
- **Custom hooks** for common patterns
- **Responsive design** with Tailwind CSS
- **Recharts integration** for data visualization
- **Local storage** with hook support
- **Pagination, sorting, filtering** utilities
- **Empty states, loading skeletons, tooltips**
- **Modal dialogs, dropdowns, tabs**
- **KPI cards with sparklines**
- **Status indicators and badges**

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Proprietary - CYPHER ERP
