import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, ShoppingCart, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { Chart } from '@/components/ui/Chart';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { analyticsService } from '@/services/analytics.service';
import { ordersService } from '@/services/orders.service';
import { Order } from '@/types/order';

const columns: Column<Order>[] = [
  { key: 'orderNumber', label: 'Order Number', sortable: true },
  { key: 'customerName', label: 'Customer', sortable: true },
  {
    key: 'totalAmount',
    label: 'Amount',
    sortable: true,
    render: (value) => `${parseFloat(value).toLocaleString()} RON`,
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <StatusBadge status={value.toLowerCase()} />,
  },
  { 
    key: 'createdAt', 
    label: 'Date', 
    sortable: true,
    render: (value) => new Date(value).toLocaleDateString('ro-RO')
  },
];

export function DashboardPage() {
  // Fetch real KPI data
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: () => analyticsService.getKPIs(),
  });

  // Fetch real recent orders
  const { data: recentOrdersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => ordersService.getOrders({ page: 1, limit: 5 }),
  });

  // Fetch sales analytics for chart
  const { data: salesAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', 'sales', 'last-30-days'],
    queryFn: () => {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return analyticsService.getSalesAnalytics({ startDate, endDate, groupBy: 'day' });
    },
  });

  if (kpisLoading || ordersLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const findKPI = (name: string) => kpis?.find(k => k.name === name) || { value: 0, change: 0, trend: [] };
  
  const revenueKPI = findKPI('TOTAL_REVENUE');
  const ordersKPI = findKPI('ORDER_COUNT');
  const aovKPI = findKPI('AVG_ORDER_VALUE');
  const conversionKPI = findKPI('CONVERSION_RATE');

  const chartData = salesAnalytics?.dailyOrders?.map((d: any, i: number) => ({
    name: d.date,
    sales: salesAnalytics.dailyRevenue[i]?.total || 0,
    orders: d.count
  })) || [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Bun venit înapoi! Iată o privire de ansamblu asupra afacerii tale.</p>
        </div>
        <button className="btn-primary">Export Raport</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={<ShoppingCart size={20} />}
          title="Comenzi Totale"
          value={ordersKPI.value.toLocaleString()}
          change={{ value: Math.abs(ordersKPI.change), isPositive: ordersKPI.change >= 0 }}
          sparklineData={ordersKPI.trend?.map(v => ({ value: v }))}
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          title="Venituri"
          value={`${revenueKPI.value.toLocaleString()} RON`}
          change={{ value: Math.abs(revenueKPI.change), isPositive: revenueKPI.change >= 0 }}
          color="success"
          sparklineData={revenueKPI.trend?.map(v => ({ value: v }))}
        />
        <KPICard
          icon={<BarChart size={20} />}
          title="Valoare Medie Comandă"
          value={`${aovKPI.value.toLocaleString()} RON`}
          change={{ value: Math.abs(aovKPI.change), isPositive: aovKPI.change >= 0 }}
          sparklineData={aovKPI.trend?.map(v => ({ value: v }))}
        />
        <KPICard
          icon={<AlertCircle size={20} />}
          title="Rată Conversie"
          value={`${conversionKPI.value.toFixed(2)}%`}
          change={{ value: Math.abs(conversionKPI.change), isPositive: conversionKPI.change >= 0 }}
          color="warning"
          sparklineData={conversionKPI.trend?.map(v => ({ value: v }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart
          type="bar"
          data={chartData}
          dataKey="sales"
          xAxisKey="name"
          title="Vânzări Zilnice"
          height={300}
        />
        <Chart
          type="line"
          data={chartData}
          dataKey="orders"
          xAxisKey="name"
          title="Comenzi Zilnice"
          height={300}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Comenzi Recente</h2>
        <DataTable columns={columns} data={recentOrdersData?.data || []} />
      </div>
    </div>
  );
}
