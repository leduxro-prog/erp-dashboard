import { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/ui/KPICard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient } from '@/services/api';

interface StockLevelItem {
  id: number;
  productId: number;
  sku: string;
  name: string;
  price: number;
  imageUrl: string | null;
  warehouseId: number;
  warehouseName: string;
  current: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  status: 'Normal' | 'Atentionare' | 'Critic';
  updatedAt: string;
}

interface StockLevelsResponse {
  success: boolean;
  data: {
    items: StockLevelItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export function InventoryPage() {
  const [stockLevels, setStockLevels] = useState<StockLevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchStockLevels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (search) params.set('search', search);

      const response = await apiClient.get<StockLevelsResponse>(
        `/inventory/stock-levels?${params.toString()}`,
      );
      const data = (response as any)?.data || response;
      setStockLevels(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Eroare la incarcarea datelor de stoc');
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchStockLevels();
  }, [fetchStockLevels]);

  const criticalCount = stockLevels.filter((s) => s.status === 'Critic').length;
  const warningCount = stockLevels.filter((s) => s.status === 'Atentionare').length;
  const normalCount = stockLevels.filter((s) => s.status === 'Normal').length;

  const columns: Column<StockLevelItem>[] = [
    {
      key: 'imageUrl',
      label: 'Imagine',
      width: '80px',
      render: (value, row) => (
        <div className="flex items-center justify-center">
          {value ? (
            <img
              src={value as string}
              alt={row.name}
              className="w-12 h-12 object-cover rounded border border-gray-600"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpath d="m21 15-5-5L5 21"/%3E%3C/svg%3E';
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-700 rounded border border-gray-600 flex items-center justify-center">
              <Package size={20} className="text-gray-500" />
            </div>
          )}
        </div>
      ),
    },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'name', label: 'Produs', sortable: true },
    {
      key: 'price',
      label: 'Pret',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-blue-400">
          {(value as number).toLocaleString('ro-RO', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          RON
        </span>
      ),
    },
    {
      key: 'current',
      label: 'Stoc curent',
      sortable: true,
      render: (value) => <span className="font-medium">{(value as number).toLocaleString()}</span>,
    },
    {
      key: 'reserved',
      label: 'Rezervat',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
    {
      key: 'available',
      label: 'Disponibil',
      sortable: true,
      render: (value) => (
        <span className="font-medium text-green-400">{(value as number).toLocaleString()}</span>
      ),
    },
    {
      key: 'reorderPoint',
      label: 'Limita min',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const status = value as string;
        const statusMap: Record<string, 'pending' | 'processing' | 'completed'> = {
          Normal: 'completed',
          Atentionare: 'processing',
          Critic: 'pending',
        };
        return <StatusBadge status={statusMap[status] || 'pending'} label={status} />;
      },
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Inventar</h1>
          <p className="text-gray-300 mt-1">
            Gestiunea nivelurilor de stoc — {total.toLocaleString()} produse
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={fetchStockLevels}
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Actualizeaza
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          icon={<Package size={20} />}
          title="Total produse"
          value={total.toLocaleString()}
        />
        <KPICard
          icon={<AlertTriangle size={20} />}
          title="Produse sub limita"
          value={criticalCount.toString()}
          color="danger"
        />
        <KPICard
          icon={<AlertTriangle size={20} />}
          title="Atentionari"
          value={warningCount.toString()}
          color="warning"
        />
        <KPICard
          icon={<CheckCircle size={20} />}
          title="Stoc normal"
          value={normalCount.toString()}
          color="success"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cauta dupa SKU sau nume produs..."
          className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : stockLevels.length === 0 ? (
        <EmptyState
          icon={<div className="text-4xl">📊</div>}
          title={search ? 'Nu s-au gasit produse' : 'Nu exista date de stoc'}
          description={
            search
              ? 'Incearca sa modifici termenul de cautare'
              : 'Datele de stoc vor aparea aici dupa sincronizare'
          }
        />
      ) : (
        <>
          <DataTable columns={columns} data={stockLevels} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-300">
                Pagina {page} din {totalPages} ({total.toLocaleString()} produse)
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Urmator
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
