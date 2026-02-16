# CYPHER ERP Frontend - Quick Start Guide

## Installation

```bash
cd /sessions/funny-laughing-darwin/mnt/erp/cypher/frontend
npm install
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Demo Login
- **Email:** demo@ledux.ro
- **Password:** demo123

## Project Structure Quick Reference

### Layout Components
- **AppLayout** - Main page wrapper with sidebar, topbar, and outlet
- **Sidebar** - Collapsible navigation with traffic light controls
- **TopBar** - Header with breadcrumbs, search, theme toggle, notifications
- **CommandPalette** - Spotlight-style command launcher (⌘K)

### UI Components

#### Data Display
- **KPICard** - Metric cards with sparklines and trend arrows
- **DataTable** - Sortable, paginated tables with selection
- **StatusBadge** - Status indicators (pending, completed, etc.)
- **Chart** - Recharts wrapper for line/bar/area/pie charts

#### Forms & Input
- **Modal** - Dialog component with backdrop
- **Tabs** - Tab navigation with badges

#### Feedback
- **EmptyState** - Empty state placeholder with action
- **LoadingSkeleton** - Animated loading placeholders
- **Toast** - Notifications (via react-hot-toast)

### Pages (19 total)

**Dashboard:** Real-time metrics, charts, recent orders
**Orders:** Order management, status tracking
**Products:** Product catalog, categories
**Inventory:** Stock levels, warehouses, movements
**WMS:** Shipment management, logistics
**Suppliers:** Vendor relationships, contracts
**Quotations:** Customer quotations, proposals
**SmartBill:** Electronic invoices, SmartBill integration
**WooCommerce:** E-commerce sync, product management
**B2B Portal:** Business customer accounts, portal
**POS:** Point of sale transactions, reports
**CRM:** Customer management, loyalty programs
**Marketing:** Campaigns, automation
**Analytics:** BI dashboard, KPIs
**SEO:** SEO tools, automation
**Configurators:** Product customization
**Notifications:** System notification center
**WhatsApp:** Messaging integration
**Settings:** System configuration

## Key Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` or `Cmd+K` | Open Command Palette |
| `/dashboard` | Go to Dashboard |
| `/orders` | Go to Orders |
| `/products` | Go to Products |

## Common Tasks

### Add a New Page

1. Create in `src/pages/YourPage.tsx`:
```tsx
export function YourPageName() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold text-text-primary">Your Page</h1>
      {/* Content */}
    </div>
  );
}
```

2. Add route in `src/App.tsx`:
```tsx
<Route path="yourpath/*" element={<YourPageName />} />
```

3. Add to sidebar in `src/components/layout/Sidebar.tsx`:
```tsx
{ label: 'Your Item', icon: <Icon size={18} />, path: '/yourpath' }
```

### Add a Data Table

```tsx
import { DataTable, Column } from '@components/ui/DataTable';
import { StatusBadge } from '@components/ui/StatusBadge';

interface Item {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

const columns: Column<Item>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
];

export function MyPage() {
  return <DataTable columns={columns} data={items} selectable />;
}
```

### Display a Chart

```tsx
import { Chart } from '@components/ui/Chart';

export function MyPage() {
  const data = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 600 },
  ];

  return (
    <Chart
      type="line"
      data={data}
      dataKey="value"
      xAxisKey="name"
      title="Monthly Revenue"
    />
  );
}
```

### Show KPI Cards

```tsx
import { KPICard } from '@components/ui/KPICard';
import { ShoppingCart } from 'lucide-react';

export function MyPage() {
  return (
    <KPICard
      icon={<ShoppingCart size={20} />}
      title="Total Orders"
      value="1,234"
      change={{ value: 12, isPositive: true }}
    />
  );
}
```

### Call API Service

```tsx
import { ordersService } from '@services/orders.service';
import { useQuery } from '@tanstack/react-query';

export function MyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersService.getOrders({ page: 1, limit: 20 }),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div>Error loading orders</div>;

  return <DataTable columns={columns} data={data?.data?.items || []} />;
}
```

## Styling Guidelines

### Button Classes
- `.btn-primary` - Main action buttons (blue)
- `.btn-secondary` - Alternative actions
- `.btn-ghost` - Tertiary/subtle actions
- `.btn-danger` - Destructive actions (red)

### Card Classes
- `.card` - Standard card container
- `.card-hover` - Card with hover effect
- `.kpi-card` - KPI metric card

### Badge Classes
- `.badge-success` - Green badge
- `.badge-warning` - Orange badge
- `.badge-danger` - Red badge
- `.badge-info` - Blue badge
- `.badge-neutral` - Gray badge

### Text Classes
- `.text-text-primary` - Main text
- `.text-text-secondary` - Secondary text
- `.text-text-tertiary` - Tertiary text
- `.section-title` - Section headings

### Colors in Tailwind
```tsx
// Accent colors
bg-accent, text-accent, border-accent

// Semantic colors
text-accent-success, bg-accent-warning/15, text-accent-danger

// Surfaces
bg-white dark:bg-neutral-900
bg-surface dark:bg-surface-dark
```

## Icon Usage

```tsx
import { ShoppingCart, Plus, Settings, ChevronDown } from 'lucide-react';

// In JSX
<ShoppingCart size={18} />
<Plus size={24} className="text-accent" />
```

### Available Icon Sizes
- `size={12}` - Extra small
- `size={16}` - Small
- `size={18}` - Default
- `size={20}` - Medium
- `size={24}` - Large
- `size={32}` - Extra large

## Form Handling

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email(),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register('name')} className="input" />
      {errors.name && <span className="text-accent-danger">{errors.name.message}</span>}
      <button type="submit" className="btn-primary">Submit</button>
    </form>
  );
}
```

## Toast Notifications

```tsx
import toast from 'react-hot-toast';

export function MyComponent() {
  const handleSuccess = () => {
    toast.success('Operation successful!');
  };

  const handleError = () => {
    toast.error('Something went wrong');
  };

  return (
    <>
      <button onClick={handleSuccess} className="btn-primary">Success</button>
      <button onClick={handleError} className="btn-danger">Error</button>
    </>
  );
}
```

## Modals

```tsx
import { Modal } from '@components/ui/Modal';
import { useState } from 'react';

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-primary">Open Modal</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modal Title"
        size="md"
        footer={
          <div className="flex gap-3">
            <button className="btn-secondary">Cancel</button>
            <button className="btn-primary">Confirm</button>
          </div>
        }
      >
        <p>Modal content here</p>
      </Modal>
    </>
  );
}
```

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory. Optimizations include:
- Code splitting per module
- CSS minification
- JavaScript minification
- Tree-shaking of unused code

## Environment Setup

Create `.env.local`:
```
VITE_API_URL=http://localhost:4000/api
```

## Troubleshooting

### Port 3000 already in use
```bash
npm run dev -- --port 3001
```

### Clear node_modules
```bash
rm -rf node_modules
npm install
```

### TypeScript errors
```bash
npm run build
```

### Hot reload not working
Delete `.vite/` directory and restart dev server.

## Performance Tips

1. Use `React.memo()` for expensive list items
2. Implement pagination on large datasets
3. Use React Query's caching effectively
4. Lazy load route components
5. Monitor bundle size with `npm run build`

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [React Query Docs](https://tanstack.com/query/latest)
- [Recharts Documentation](https://recharts.org)
- [Lucide Icons](https://lucide.dev)

## Support

For issues or questions, refer to:
- `/src/components` - Component examples
- `/src/pages` - Page implementations
- `/src/services` - API integration patterns
- `/src/types` - TypeScript type definitions

---

**Happy coding! 🚀**
