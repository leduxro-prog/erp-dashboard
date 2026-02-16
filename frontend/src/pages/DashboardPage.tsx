import { BarChart, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { Chart } from '@/components/ui/Chart';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed';
  date: string;
}

const mockOrders: RecentOrder[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customer: 'ACME Corp',
    amount: 2500.0,
    status: 'completed',
    date: '2024-02-05',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customer: 'TechStart Inc',
    amount: 1850.5,
    status: 'processing',
    date: '2024-02-04',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customer: 'Global Solutions',
    amount: 3200.0,
    status: 'pending',
    date: '2024-02-03',
  },
];

const chartData = [
  { name: 'Week 1', sales: 2400, orders: 24 },
  { name: 'Week 2', sales: 1398, orders: 21 },
  { name: 'Week 3', sales: 9800, orders: 29 },
  { name: 'Week 4', sales: 3908, orders: 20 },
];

const sparklineData = [
  { value: 400 },
  { value: 600 },
  { value: 500 },
  { value: 700 },
  { value: 650 },
];

const columns: Column<RecentOrder>[] = [
  { key: 'orderNumber', label: 'Order Number', sortable: true },
  { key: 'customer', label: 'Customer', sortable: true },
  {
    key: 'amount',
    label: 'Amount',
    sortable: true,
    render: (value) => `$${value.toFixed(2)}`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value} />,
  },
  { key: 'date', label: 'Date', sortable: true },
];

export function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Welcome back! Here's an overview of your business.</p>
        </div>
        <button className="btn-primary">Export Report</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={<ShoppingCart size={20} />}
          title="Total Orders"
          value="1,234"
          change={{ value: 12, isPositive: true }}
          sparklineData={sparklineData}
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          title="Revenue"
          value="$45,230"
          change={{ value: 8, isPositive: true }}
          color="success"
          sparklineData={sparklineData}
        />
        <KPICard
          icon={<BarChart size={20} />}
          title="Average Order Value"
          value="$367"
          change={{ value: 3, isPositive: false }}
          sparklineData={sparklineData}
        />
        <KPICard
          icon={<AlertCircle size={20} />}
          title="Pending Orders"
          value="23"
          change={{ value: 5, isPositive: true }}
          color="warning"
          sparklineData={sparklineData}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={chartData}
          dataKey="sales"
          xAxisKey="name"
          title="Weekly Sales"
          height={300}
        />
        <Chart
          type="line"
          data={chartData}
          dataKey="orders"
          xAxisKey="name"
          title="Weekly Orders"
          height={300}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Orders</h2>
        <DataTable columns={columns} data={mockOrders} />
      </div>
    </div>
  );
}
