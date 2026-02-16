# CYPHER ERP UI Components Guide

Complete reference for all available UI components with examples and props.

## UI Components

### Card
macOS-style card with frosted glass effect, subtle shadow, rounded corners.

**Props:**
- `title?: string` - Card title
- `subtitle?: string` - Card subtitle
- `icon?: React.ReactNode` - Icon element
- `children: React.ReactNode` - Card content
- `className?: string` - Additional CSS classes
- `padding?: 'none' | 'sm' | 'md' | 'lg'` - Padding size (default: 'md')
- `onClick?: () => void` - Click handler

**Example:**
```tsx
import { Card } from '@/components/ui';

<Card 
  title="Monthly Sales" 
  subtitle="January 2024"
  icon={<BarChart3 className="w-5 h-5" />}
  padding="lg"
>
  <p>Content goes here</p>
</Card>
```

---

### Button
macOS-style buttons with multiple variants and states.

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'` - Button style (default: 'primary')
- `size?: 'sm' | 'md' | 'lg'` - Button size (default: 'md')
- `loading?: boolean` - Show loading spinner
- `icon?: React.ReactNode` - Icon element
- `iconPosition?: 'left' | 'right'` - Icon position (default: 'left')
- `disabled?: boolean` - Disable button
- `children: React.ReactNode` - Button text
- All standard HTML button attributes

**Example:**
```tsx
import { Button } from '@/components/ui';

<Button 
  variant="primary" 
  size="lg" 
  icon={<Save />}
  iconPosition="left"
  loading={isSaving}
  onClick={handleSave}
>
  Save Changes
</Button>
```

---

### Input
macOS-style text input with validation and icons.

**Props:**
- `label?: string` - Input label
- `placeholder?: string` - Placeholder text
- `error?: string` - Error message
- `icon?: React.ReactNode` - Icon element
- `iconPosition?: 'prefix' | 'suffix'` - Icon position (default: 'prefix')
- `variant?: 'default' | 'search'` - Input variant (default: 'default')
- `disabled?: boolean` - Disable input
- `readonly?: boolean` - Read-only mode
- All standard HTML input attributes

**Example:**
```tsx
import { Input } from '@/components/ui';

<Input 
  label="Email Address"
  placeholder="user@example.com"
  type="email"
  error={errors.email}
  icon={<Mail />}
  iconPosition="prefix"
/>

<Input 
  placeholder="Search products..."
  variant="search"
/>
```

---

### Badge
Status badges with color coding.

**Props:**
- `status?: 'success' | 'warning' | 'error' | 'info' | 'neutral'` - Badge status (default: 'neutral')
- `children: React.ReactNode` - Badge text
- `className?: string` - Additional CSS classes
- `icon?: React.ReactNode` - Badge icon

**Example:**
```tsx
import { Badge } from '@/components/ui';

<Badge status="success" icon={<Check />}>Order Delivered</Badge>
<Badge status="warning">Pending Review</Badge>
<Badge status="error">Payment Failed</Badge>
<Badge status="info">New Update Available</Badge>
```

---

### Modal
macOS-style dialog with smooth animations and backdrop.

**Props:**
- `isOpen: boolean` - Control modal visibility
- `onClose: () => void` - Close handler
- `title?: string` - Modal title
- `children: React.ReactNode` - Modal content
- `footer?: React.ReactNode` - Footer content (usually action buttons)
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Modal size (default: 'md')
- `closeOnBackdropClick?: boolean` - Close when clicking backdrop (default: true)

**Example:**
```tsx
import { Modal, Button } from '@/components/ui';
import { useState } from 'react';

const [isOpen, setIsOpen] = useState(false);

<>
  <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
  
  <Modal
    isOpen={isOpen}
    onClose={() => setIsOpen(false)}
    title="Confirm Delete"
    size="md"
    footer={
      <>
        <Button variant="secondary" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </>
    }
  >
    <p>Are you sure you want to delete this item?</p>
  </Modal>
</>
```

---

### Table
Sortable, paginated data table with selection.

**Props:**
- `columns: Column<T>[]` - Column definitions
  - `key: keyof T` - Data key
  - `label: string` - Column header
  - `sortable?: boolean` - Enable sorting
  - `width?: string` - Column width
  - `render?: (value, row) => ReactNode` - Custom renderer
- `data: T[]` - Table data
- `keyExtractor: (row, index) => string | number` - Row key generator
- `selectable?: boolean` - Enable row selection
- `onSelectionChange?: (selected) => void` - Selection handler
- `loading?: boolean` - Show loading skeleton
- `emptyMessage?: string` - Empty state message
- `onRowClick?: (row) => void` - Row click handler
- `pagination?: PaginationConfig` - Pagination settings

**Example:**
```tsx
import { Table } from '@/components/ui';

const columns = [
  { 
    key: 'name', 
    label: 'Product Name', 
    sortable: true,
    width: '250px'
  },
  { 
    key: 'price', 
    label: 'Price',
    render: (price) => `$${price.toFixed(2)}`
  },
  { 
    key: 'status', 
    label: 'Status',
    render: (status) => <Badge status={status}>{status}</Badge>
  },
];

<Table
  columns={columns}
  data={products}
  keyExtractor={(row) => row.id}
  selectable={true}
  onSelectionChange={(selected) => setSelected(selected)}
  onRowClick={(row) => navigate(`/products/${row.id}`)}
  pagination={{
    page,
    limit: 10,
    total: 100,
    onPageChange: setPage
  }}
/>
```

---

### Select
Dropdown select with search and multi-select support.

**Props:**
- `label?: string` - Select label
- `options: SelectOption[]` - Available options
  - `value: string | number` - Option value
  - `label: string` - Option label
- `value?: string | number | (string | number)[]` - Selected value(s)
- `onChange: (value) => void` - Change handler
- `placeholder?: string` - Placeholder text
- `multi?: boolean` - Enable multi-select
- `searchable?: boolean` - Enable search
- `disabled?: boolean` - Disable select
- `error?: string` - Error message

**Example:**
```tsx
import { Select } from '@/components/ui';

const [selected, setSelected] = useState<string>('');

<Select
  label="Category"
  options={[
    { value: '1', label: 'Electronics' },
    { value: '2', label: 'Clothing' },
    { value: '3', label: 'Food' },
  ]}
  value={selected}
  onChange={setSelected}
  searchable={true}
  placeholder="Select a category"
/>

// Multi-select
<Select
  label="Tags"
  options={tagOptions}
  value={selectedTags}
  onChange={setSelectedTags}
  multi={true}
/>
```

---

### Tabs
Segmented control tabs.

**Props:**
- `tabs: TabItem[]` - Tab definitions
  - `id: string` - Tab identifier
  - `label: string` - Tab label
  - `icon?: React.ReactNode` - Tab icon
  - `content: React.ReactNode` - Tab content
- `defaultTab?: string` - Initial active tab
- `onChange?: (tabId) => void` - Tab change handler

**Example:**
```tsx
import { Tabs } from '@/components/ui';

<Tabs
  tabs={[
    {
      id: 'details',
      label: 'Details',
      icon: <Info />,
      content: <OrderDetails />
    },
    {
      id: 'items',
      label: 'Items',
      icon: <ShoppingCart />,
      content: <OrderItems />
    },
    {
      id: 'history',
      label: 'History',
      icon: <Clock />,
      content: <OrderHistory />
    },
  ]}
  defaultTab="details"
  onChange={(tabId) => console.log('Active tab:', tabId)}
/>
```

---

### ProgressBar
Animated progress bar with percentage label.

**Props:**
- `value: number` - Current progress
- `max?: number` - Maximum value (default: 100)
- `showLabel?: boolean` - Show percentage (default: true)
- `size?: 'sm' | 'md' | 'lg'` - Bar height (default: 'md')
- `color?: 'blue' | 'green' | 'red' | 'orange'` - Bar color (default: 'blue')

**Example:**
```tsx
import { ProgressBar } from '@/components/ui';

<ProgressBar value={75} max={100} />
<ProgressBar value={2} max={5} color="green" size="lg" />
<ProgressBar value={processingPercent} showLabel={true} />
```

---

### Avatar
User avatar with fallback initials and status.

**Props:**
- `src?: string` - Avatar image URL
- `name: string` - User name (for initials fallback)
- `size?: 'sm' | 'md' | 'lg'` - Avatar size (default: 'md')
- `status?: 'online' | 'offline' | 'busy' | 'away'` - Status indicator
- `onClick?: () => void` - Click handler

**Example:**
```tsx
import { Avatar } from '@/components/ui';

<Avatar 
  name="John Doe" 
  src="https://..."
  size="md"
  status="online"
/>

<Avatar 
  name="Jane Smith"
  size="lg"
  status="away"
/>
```

---

### Tooltip
Subtle tooltip on hover.

**Props:**
- `content: string` - Tooltip text
- `children: React.ReactNode` - Trigger element
- `position?: 'top' | 'bottom' | 'left' | 'right'` - Tooltip position (default: 'top')
- `delay?: number` - Hover delay in ms

**Example:**
```tsx
import { Tooltip } from '@/components/ui';

<Tooltip content="Click to save changes" position="bottom">
  <Button>Save</Button>
</Tooltip>

<Tooltip content="Delete this item permanently" delay={300}>
  <Button variant="danger" icon={<Trash2 />} />
</Tooltip>
```

---

### Dropdown
Dropdown menu with keyboard navigation.

**Props:**
- `trigger: React.ReactNode` - Trigger element
- `items: DropdownItem[]` - Menu items
  - `id: string` - Item identifier
  - `label: string` - Item label
  - `icon?: React.ReactNode` - Item icon
  - `onClick: () => void` - Click handler
  - `variant?: 'default' | 'danger'` - Item style
- `align?: 'left' | 'right'` - Menu alignment (default: 'right')

**Example:**
```tsx
import { Dropdown } from '@/components/ui';

<Dropdown
  trigger={<Button icon={<MoreVertical />} variant="ghost" />}
  items={[
    {
      id: 'edit',
      label: 'Edit',
      icon: <Edit2 />,
      onClick: () => handleEdit()
    },
    {
      id: 'copy',
      label: 'Duplicate',
      icon: <Copy />,
      onClick: () => handleDuplicate()
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      variant: 'danger',
      onClick: () => handleDelete()
    },
  ]}
  align="right"
/>
```

---

### Skeleton
Loading skeleton with shimmer animation.

**Props:**
- `variant?: 'text' | 'card' | 'table' | 'avatar'` - Skeleton type (default: 'text')
- `count?: number` - Number of lines (for text variant)
- `width?: string` - Width (default: '100%')
- `height?: string` - Height (default: '1rem')
- `className?: string` - Additional CSS classes

**Example:**
```tsx
import { Skeleton } from '@/components/ui';

{isLoading ? (
  <Skeleton variant="card" />
) : (
  <Card>Content</Card>
)}

<Skeleton variant="text" count={3} />
<Skeleton variant="avatar" />
<Skeleton variant="table" />
```

---

### EmptyState
Empty state with icon, title, and action.

**Props:**
- `icon: React.ReactNode` - Empty state icon
- `title: string` - Title text
- `description: string` - Description text
- `actionLabel?: string` - Action button label
- `onAction?: () => void` - Action handler

**Example:**
```tsx
import { EmptyState } from '@/components/ui';

{items.length === 0 ? (
  <EmptyState
    icon="📦"
    title="No orders yet"
    description="Create your first order to get started"
    actionLabel="Create Order"
    onAction={() => navigate('/orders/new')}
  />
) : (
  <OrderList items={items} />
)}
```

---

### StatusDot
Colored status indicator dot.

**Props:**
- `status: 'online' | 'offline' | 'busy' | 'away'` - Status type
- `label?: string` - Custom label
- `size?: 'sm' | 'md' | 'lg'` - Dot size (default: 'md')

**Example:**
```tsx
import { StatusDot } from '@/components/ui';

<StatusDot status="online" />
<StatusDot status="busy" label="In a meeting" />
<StatusDot status="away" size="lg" />
```

---

### KPICard
KPI metric card with trend and sparkline.

**Props:**
- `icon: React.ReactNode` - KPI icon
- `label: string` - KPI label
- `value: string | number` - KPI value
- `change?: number` - Percentage change
- `showTrend?: boolean` - Show trend indicator (default: true)
- `sparklineData?: number[]` - Sparkline data points
- `onClick?: () => void` - Click handler

**Example:**
```tsx
import { KPICard } from '@/components/ui';

<KPICard
  icon={<DollarSign />}
  label="Total Revenue"
  value="$125,430"
  change={12.5}
  sparklineData={[100, 120, 110, 130, 125, 140, 135]}
  onClick={() => navigate('/analytics/revenue')}
/>
```

---

## Chart Components

### AreaChart
Recharts area chart with gradient fill.

**Props:**
- `data: any[]` - Chart data
- `dataKey: string` - Data key to plot
- `xAxisKey: string` - X-axis data key
- `title?: string` - Chart title
- `height?: number` - Chart height (default: 300)
- `gradient?: boolean` - Enable gradient (default: true)

**Example:**
```tsx
import { AreaChart } from '@/components/charts';

const data = [
  { date: '2024-01-01', sales: 1200 },
  { date: '2024-01-02', sales: 1900 },
  { date: '2024-01-03', sales: 1600 },
];

<AreaChart
  data={data}
  dataKey="sales"
  xAxisKey="date"
  title="Monthly Sales"
  height={400}
/>
```

---

### BarChart
Recharts bar chart with rounded bars.

**Props:**
- `data: any[]` - Chart data
- `dataKey: string` - Data key to plot
- `xAxisKey: string` - X-axis data key
- `title?: string` - Chart title
- `height?: number` - Chart height (default: 300)
- `stacked?: boolean` - Stack bars (default: false)
- `color?: string` - Bar color (default: '#3b82f6')

**Example:**
```tsx
import { BarChart } from '@/components/charts';

<BarChart
  data={salesData}
  dataKey="revenue"
  xAxisKey="month"
  title="Quarterly Revenue"
  color="#10b981"
/>
```

---

### PieChart
Recharts donut chart with center label.

**Props:**
- `data: any[]` - Chart data
- `dataKey: string` - Data key for values
- `nameKey: string` - Data key for labels
- `title?: string` - Chart title
- `height?: number` - Chart height (default: 300)
- `donut?: boolean` - Donut style (default: true)
- `colors?: string[]` - Custom colors

**Example:**
```tsx
import { PieChart } from '@/components/charts';

<PieChart
  data={categoryData}
  dataKey="count"
  nameKey="category"
  title="Products by Category"
  donut={true}
/>
```

---

### LineChart
Multi-line chart with legend.

**Props:**
- `data: any[]` - Chart data
- `dataKeys: LineDataKey[]` - Lines to plot
  - `key: string` - Data key
  - `color?: string` - Line color
  - `name?: string` - Line label
- `xAxisKey: string` - X-axis data key
- `title?: string` - Chart title
- `height?: number` - Chart height (default: 300)

**Example:**
```tsx
import { LineChart } from '@/components/charts';

<LineChart
  data={trendData}
  dataKeys={[
    { key: 'sales', color: '#3b82f6', name: 'Sales' },
    { key: 'revenue', color: '#10b981', name: 'Revenue' }
  ]}
  xAxisKey="date"
  title="Sales vs Revenue Trend"
/>
```

---

## Component Styling

All components use Tailwind CSS and can be customized with:

1. **Props**: `className` prop for additional classes
2. **Tailwind**: Inline Tailwind classes via props
3. **CSS**: Global styles in `globals.css`
4. **Theme**: Customize in `tailwind.config.js`

Example:
```tsx
<Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
  <h3 className="text-lg font-bold text-blue-900">Custom Styled Card</h3>
</Card>
```
