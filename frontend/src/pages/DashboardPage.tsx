import { useState, useEffect } from 'react';
import { BarChart, ShoppingCart, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { Chart } from '@/components/ui/Chart';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient } from '@/services/api';

interface SalesMetrics {
  total_revenue: number;
  revenue_growth: number;
  total_orders: number;
  orders_growth: number;
  average_order_value: number;
  aov_change: number;
  conversion_rate: number;
  conversion_change: number;
  customer_acquisition_cost: number;
  cac_change: number;
  lifetime_value: number;
  top_products: Array<{ product_id: string; name: string; revenue: number }>;
}

interface InventoryMetrics {
  total_stock_value: number;
  stock_value_change: number;
  inventory_turnover: number;
  turnover_change: number;
  stock_out_items: number;
  low_stock_items: number;
  excess_stock_items: number;
  inventory_accuracy: number;
  warehouse_utilization: number;
}

interface OrderSummary {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  grand_total: number;
  currency: string;
  created_at: string;
  payment_status: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO').format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const columns: Column<OrderSummary>[] = [
  { key: 'order_number', label: 'Numar Comanda', sortable: true },
  { key: 'customer_name', label: 'Client', sortable: true },
  {
    key: 'grand_total',
    label: 'Total',
    sortable: true,
    render: (value: number) => formatCurrency(value),
  },
  {
    key: 'status',
    label: 'Status',
    render: (value: string) => <StatusBadge status={value} />,
  },
  {
    key: 'created_at',
    label: 'Data',
    sortable: true,
    render: (value: string) => formatDate(value),
  },
];

export function DashboardPage() {
  const [salesKPI, setSalesKPI] = useState<SalesMetrics | null>(null);
  const [inventoryKPI, setInventoryKPI] = useState<InventoryMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError(null);

      const [salesResult, inventoryResult, ordersResult] = await Promise.allSettled([
        apiClient.get<{ success: boolean; data: { metrics: SalesMetrics } }>(
          '/analytics/kpi/sales',
        ),
        apiClient.get<{ success: boolean; data: { metrics: InventoryMetrics } }>(
          '/analytics/kpi/inventory',
        ),
        apiClient.get<{
          success: boolean;
          data: OrderSummary[];
          meta: { pagination: { total: number } };
        }>('/orders?page=1&limit=5'),
      ]);

      const errors: string[] = [];

      if (salesResult.status === 'fulfilled' && salesResult.value?.data?.metrics) {
        setSalesKPI(salesResult.value.data.metrics);
      } else {
        errors.push('Eroare la incarcarea KPI vanzari');
      }

      if (inventoryResult.status === 'fulfilled' && inventoryResult.value?.data?.metrics) {
        setInventoryKPI(inventoryResult.value.data.metrics);
      } else {
        errors.push('Eroare la incarcarea KPI inventar');
      }

      if (ordersResult.status === 'fulfilled' && ordersResult.value?.data) {
        const ordersData = ordersResult.value.data;
        setRecentOrders(Array.isArray(ordersData) ? ordersData : []);
      } else {
        errors.push('Eroare la incarcarea comenzilor recente');
      }

      if (errors.length > 0) {
        setError(errors.join('. '));
      }

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const chartData = salesKPI?.top_products?.length
    ? salesKPI.top_products.map((p) => ({
        name: p.name,
        revenue: p.revenue,
      }))
    : [{ name: 'N/A', revenue: 0 }];

  const inventoryChartData = inventoryKPI
    ? [
        { name: 'Stoc epuizat', items: inventoryKPI.stock_out_items },
        { name: 'Stoc redus', items: inventoryKPI.low_stock_items },
        { name: 'Stoc in exces', items: inventoryKPI.excess_stock_items },
      ]
    : [{ name: 'N/A', items: 0 }];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-text-secondary">Se incarca datele...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-8 space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">
            Bun venit! Iata o privire de ansamblu asupra afacerii tale.
          </p>
        </div>
        <button className="btn-primary w-full sm:w-auto">Export Raport</button>
      </div>

      {error && (
        <div className="rounded-lg border border-accent-warning/30 bg-accent-warning/10 px-4 py-3 text-sm text-accent-warning">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={<ShoppingCart size={20} />}
          title="Total Comenzi"
          value={salesKPI ? formatNumber(salesKPI.total_orders) : '0'}
          change={{
            value: salesKPI?.orders_growth ?? 0,
            isPositive: (salesKPI?.orders_growth ?? 0) >= 0,
          }}
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          title="Venituri"
          value={salesKPI ? formatCurrency(salesKPI.total_revenue) : '0 RON'}
          change={{
            value: salesKPI?.revenue_growth ?? 0,
            isPositive: (salesKPI?.revenue_growth ?? 0) >= 0,
          }}
          color="success"
        />
        <KPICard
          icon={<BarChart size={20} />}
          title="Valoare Medie Comanda"
          value={salesKPI ? formatCurrency(salesKPI.average_order_value) : '0 RON'}
          change={{
            value: salesKPI?.aov_change ?? 0,
            isPositive: (salesKPI?.aov_change ?? 0) >= 0,
          }}
        />
        <KPICard
          icon={<AlertCircle size={20} />}
          title="Produse Stoc Redus"
          value={inventoryKPI ? formatNumber(inventoryKPI.low_stock_items) : '0'}
          change={{
            value: inventoryKPI?.stock_value_change ?? 0,
            isPositive: (inventoryKPI?.stock_value_change ?? 0) >= 0,
          }}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={chartData}
          dataKey="revenue"
          xAxisKey="name"
          title="Venituri per Produs (Top)"
          height={300}
        />
        <Chart
          type="bar"
          data={inventoryChartData}
          dataKey="items"
          xAxisKey="name"
          title="Stare Inventar"
          height={300}
          colors={['#FF9500']}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Comenzi Recente</h2>
        {recentOrders.length > 0 ? (
          <DataTable columns={columns} data={recentOrders} />
        ) : (
          <div className="card p-8 text-center text-text-secondary">Nu exista comenzi recente.</div>
        )}
      </div>
    </div>
  );
}
