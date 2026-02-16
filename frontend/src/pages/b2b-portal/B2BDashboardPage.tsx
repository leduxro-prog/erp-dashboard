import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, CreditCard, ShoppingBag, TrendingUp, Package, Clock,
  Bell, ChevronRight, ShoppingCart, FileText, Headphones, Star,
  Sparkles, Percent, AlertTriangle, Calendar, ArrowUpRight, Loader2
} from 'lucide-react';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { b2bApi } from '../../services/b2b-api';
import { CreditWidget } from '../../components/b2b/CreditWidget';
import { ORDER_STATUS_CONFIG } from '../../constants/b2b-portal';

interface DashboardStats {
  totalOrders: number;
  processingOrders: number;
  totalPurchased: number;
  totalSavings: number;
  creditAvailable: number;
  creditUsed: number;
  lastOrderDate: string | null;
}

interface Notification {
  id: string;
  type: 'pending' | 'payment' | 'stock' | 'info';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url?: string;
  category?: string;
  discount_percent?: number;
  is_new?: boolean;
  is_promo?: boolean;
  stock?: number;
}

const tierConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  STANDARD: { color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300', label: 'STANDARD' },
  SILVER: { color: 'text-gray-600', bg: 'bg-gradient-to-r from-gray-200 to-gray-300', border: 'border-gray-400', label: 'SILVER' },
  GOLD: { color: 'text-yellow-800', bg: 'bg-gradient-to-r from-yellow-100 to-yellow-200', border: 'border-yellow-400', label: 'GOLD' },
  PLATINUM: { color: 'text-blue-900', bg: 'bg-gradient-to-r from-blue-100 to-purple-100', border: 'border-blue-400', label: 'PLATINUM' },
};

export const B2BDashboardPage: React.FC = () => {
  const { customer } = useB2BAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [promoProducts, setPromoProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [
        statsData, 
        ordersData, 
        notificationsData, 
        favoritesData, 
        newData, 
        promoData
      ] = await Promise.allSettled([
        b2bApi.getDashboardStats(),
        b2bApi.getOrders({ page: 1, limit: 5 }),
        b2bApi.getNotifications(),
        b2bApi.getFavoriteProducts(),
        b2bApi.getNewProducts(),
        b2bApi.getPromoProducts()
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }
      
      if (ordersData.status === 'fulfilled') {
        setRecentOrders(ordersData.value.orders || []);
      }

      if (notificationsData.status === 'fulfilled') {
        setNotifications(notificationsData.value || []);
      }

      if (favoritesData.status === 'fulfilled') {
        setFavoriteProducts(favoritesData.value || []);
      }

      if (newData.status === 'fulfilled') {
        setNewProducts(newData.value || []);
      }

      if (promoData.status === 'fulfilled') {
        setPromoProducts(promoData.value || []);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const tierKey = customer?.tier?.toUpperCase() || 'STANDARD';
  const tier = tierConfig[tierKey] || tierConfig.STANDARD;
  
  const creditAvailable = stats?.creditAvailable ?? 0;
  const creditUsed = stats?.creditUsed ?? 0;
  const creditPercentage = creditAvailable > 0 
    ? (creditUsed / creditAvailable) * 100 
    : 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-red-600" />;
      case 'stock': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default: return <Bell className="w-4 h-4 text-blue-600" />;
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enterprise Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{customer?.company_name || 'Companie B2B'}</h1>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${tier.bg} ${tier.color} ${tier.border} border`}>
                  {tier.label}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">Portal B2B Enterprise Dashboard</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Credit Disponibil</span>
                <span className="text-sm font-medium">
                  {formatCurrency(creditAvailable - creditUsed)} / {formatCurrency(creditAvailable)}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    creditPercentage > 80 ? 'bg-red-500' : 
                    creditPercentage > 60 ? 'bg-yellow-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(creditPercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>{creditPercentage.toFixed(0)}% utilizat</span>
                <span>Credit utilizat: {formatCurrency(creditUsed)}</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10 min-w-[180px]">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                <span>Ultima comandă</span>
              </div>
              <p className="text-lg font-semibold">{formatDate(stats?.lastOrderDate || null)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Comenzi</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalOrders ?? 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">În Procesare</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.processingOrders ?? 0}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Valoare Achiziționată</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats?.totalPurchased ?? 0)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 font-medium">Economii Discount</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats?.totalSavings ?? 0)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Percent className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Credit Widget */}
      <CreditWidget variant="card" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              Comenzi Recente
            </h2>
            <Link to="/b2b-portal/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Vezi toate <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentOrders.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Nu există comenzi încă</p>
                <Link to="/b2b-portal/catalog" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                  Începe o comandă nouă
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nr. Comandă</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dată</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Sumă</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.slice(0, 5).map((order) => {
                    const status = order.status?.toLowerCase();
                    const config = ORDER_STATUS_CONFIG[status] || { label: order.status, bg: 'bg-gray-100', color: 'text-gray-800' };
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-medium text-gray-900">#{order.orderNumber || order.id}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-gray-900">
                          {formatCurrency(parseFloat(order.totalAmount) || 0)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => navigate(`/b2b-portal/orders/${order.id}`)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ArrowUpRight className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-600" />
              Notificări
            </h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                {notifications.filter(n => !n.read).length} noi
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-500 text-sm">
                Nu aveți notificări noi
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`px-5 py-4 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Products Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Favorite Products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Produse Favorite
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {favoriteProducts.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">Nu aveți produse favorite</p>
            ) : (
              favoriteProducts.map((product) => (
                <div 
                  key={product.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/b2b-portal/catalog?product=${product.id}`)}
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(product.price)}</p>
                    {product.stock !== undefined && <p className="text-xs text-gray-500">Stoc: {product.stock}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* New Products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Produse Noi
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {newProducts.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">Nu există produse noi</p>
            ) : (
              newProducts.map((product) => (
                <div 
                  key={product.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/b2b-portal/catalog?product=${product.id}`)}
                >
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-6 h-6 text-blue-400" />
                    )}
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      NOU
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(product.price)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Promo Products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-red-500" />
              Promoții
            </h2>
          </div>
          <div className="p-4 space-y-3">
            {promoProducts.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-sm">Nu există promoții active</p>
            ) : (
              promoProducts.map((product) => (
                <div 
                  key={product.id} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/b2b-portal/catalog?product=${product.id}`)}
                >
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center relative">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Package className="w-6 h-6 text-red-400" />
                    )}
                    {product.discount_percent && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        -{product.discount_percent}%
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600">{formatCurrency(product.price)}</p>
                    {product.discount_percent && (
                      <p className="text-xs text-gray-400 line-through">
                        {formatCurrency(product.price * (1 + product.discount_percent / 100))}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Acțiuni Rapide</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/b2b-portal/catalog"
            className="flex flex-col items-center gap-3 p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <ShoppingCart className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-700">Comandă Nouă</span>
          </Link>

          <Link
            to="/b2b-portal/catalog"
            className="flex flex-col items-center gap-3 p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
              <Package className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-700">Vezi Catalog</span>
          </Link>

          <Link
            to="/b2b-portal/invoices"
            className="flex flex-col items-center gap-3 p-5 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
              <FileText className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-700">Descarcă Facturi</span>
          </Link>

          <a
            href="mailto:support@cypher.ro"
            className="flex flex-col items-center gap-3 p-5 bg-white rounded-xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-600 transition-colors">
              <Headphones className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-700">Contactează Suport</span>
          </a>
        </div>
      </div>
    </div>
  );
};
