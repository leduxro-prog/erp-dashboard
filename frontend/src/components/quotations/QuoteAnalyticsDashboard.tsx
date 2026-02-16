/**
 * Quote Analytics Dashboard Component
 * Displays comprehensive analytics and insights for quotations
 */

import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Package,
  AlertTriangle,
} from 'lucide-react';

interface QuoteMetrics {
  totalQuotes: number;
  draftQuotes: number;
  sentQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  expiredQuotes: number;
  convertedQuotes: number;
  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
  averageQuoteValue: number;
  averageTimeToAccept: number;
  periodComparison: {
    quotesChange: number;
    valueChange: number;
    conversionRateChange: number;
  };
}

interface QuoteTrend {
  date: string;
  count: number;
  value: number;
  acceptedCount: number;
  acceptedValue: number;
}

interface CustomerStats {
  customerId: string;
  customerName: string;
  totalQuotes: number;
  acceptedQuotes: number;
  totalValue: number;
  acceptedValue: number;
  conversionRate: number;
}

interface ProductStats {
  productId: string;
  productName: string;
  sku: string;
  timesQuoted: number;
  totalQuantity: number;
  totalValue: number;
  conversionRate: number;
}

export const QuoteAnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<QuoteMetrics | null>(null);
  const [trends, setTrends] = useState<QuoteTrend[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerStats[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStats[]>([]);
  const [expiringQuotes, setExpiringQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const token = apiClient.getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Fetch all analytics data in parallel
      const [metricsRes, trendsRes, customersRes, productsRes, expiringRes] = await Promise.all([
        fetch(
          `/api/v1/quotes/analytics/metrics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          { headers },
        ),
        fetch(
          `/api/v1/quotes/analytics/trends?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&groupBy=day`,
          { headers },
        ),
        fetch('/api/v1/quotes/analytics/top-customers?limit=5', { headers }),
        fetch('/api/v1/quotes/analytics/top-products?limit=5', { headers }),
        fetch('/api/v1/quotes/analytics/expiring?withinDays=7', { headers }),
      ]);

      const [metricsData, trendsData, customersData, productsData, expiringData] =
        await Promise.all([
          metricsRes.json(),
          trendsRes.json(),
          customersRes.json(),
          productsRes.json(),
          expiringRes.json(),
        ]);

      setMetrics(metricsData.data);
      setTrends(trendsData.data);
      setTopCustomers(customersData.data);
      setTopProducts(productsData.data);
      setExpiringQuotes(expiringData.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatChange = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(1)}%`;
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-100">Analitică Oferte</h2>
        <div className="flex gap-2">
          {['7d', '30d', '90d', '1y'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {range === '7d' && 'Ultimele 7 zile'}
              {range === '30d' && 'Ultimele 30 zile'}
              {range === '90d' && 'Ultimele 90 zile'}
              {range === '1y' && 'Ultimul an'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotes */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <FileText className="text-blue-400" size={24} />
            <span
              className={`text-sm font-medium ${
                metrics.periodComparison.quotesChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatChange(metrics.periodComparison.quotesChange)}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-100 mb-1">{metrics.totalQuotes}</div>
          <div className="text-sm text-gray-400">Total Oferte</div>
        </div>

        {/* Total Value */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-green-400" size={24} />
            <span
              className={`text-sm font-medium ${
                metrics.periodComparison.valueChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatChange(metrics.periodComparison.valueChange)}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-100 mb-1">
            {formatCurrency(metrics.totalValue)}
          </div>
          <div className="text-sm text-gray-400">Valoare Totală</div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="text-emerald-400" size={24} />
            <span
              className={`text-sm font-medium ${
                metrics.periodComparison.conversionRateChange >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              {formatChange(metrics.periodComparison.conversionRateChange)}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-100 mb-1">
            {metrics.conversionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-400">Rată Conversie</div>
        </div>

        {/* Average Time to Accept */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-purple-400" size={24} />
          </div>
          <div className="text-3xl font-bold text-gray-100 mb-1">
            {metrics.averageTimeToAccept.toFixed(1)}
          </div>
          <div className="text-sm text-gray-400">Zile până la acceptare</div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Status Oferte</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{metrics.draftQuotes}</div>
            <div className="text-sm text-gray-500">Draft</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{metrics.sentQuotes}</div>
            <div className="text-sm text-gray-500">Trimise</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{metrics.acceptedQuotes}</div>
            <div className="text-sm text-gray-500">Acceptate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{metrics.rejectedQuotes}</div>
            <div className="text-sm text-gray-500">Refuzate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">{metrics.expiredQuotes}</div>
            <div className="text-sm text-gray-500">Expirate</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-blue-400" size={20} />
            <h3 className="text-lg font-semibold text-gray-100">Top Clienți</h3>
          </div>
          <div className="space-y-3">
            {topCustomers.map((customer) => (
              <div key={customer.customerId} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {customer.customerName}
                  </div>
                  <div className="text-xs text-gray-400">
                    {customer.totalQuotes} oferte • {customer.conversionRate.toFixed(0)}% conversie
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-semibold text-blue-400">
                    {formatCurrency(customer.totalValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Package className="text-green-400" size={20} />
            <h3 className="text-lg font-semibold text-gray-100">Produse Populare</h3>
          </div>
          <div className="space-y-3">
            {topProducts.map((product) => (
              <div key={product.productId} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200 truncate">
                    {product.productName}
                  </div>
                  <div className="text-xs text-gray-400">
                    {product.timesQuoted} oferte • {product.conversionRate.toFixed(0)}% conversie
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-semibold text-green-400">
                    {formatCurrency(product.totalValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expiring Quotes Alert */}
      {expiringQuotes.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-amber-400" size={20} />
            <h3 className="text-lg font-semibold text-amber-300">
              Oferte ce Expiră în 7 Zile ({expiringQuotes.length})
            </h3>
          </div>
          <div className="space-y-2">
            {expiringQuotes.slice(0, 5).map((quote) => (
              <div key={quote.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  <strong>{quote.quote_number}</strong> - {quote.customer_name}
                </span>
                <span className="text-amber-400">
                  {Math.ceil(quote.days_until_expiry)} zile • {formatCurrency(quote.total_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
