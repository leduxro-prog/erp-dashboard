import { useState, useEffect, type FormEvent } from 'react';
import {
  Truck,
  Package,
  Search,
  RefreshCw,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  History,
  Warehouse as WarehouseIcon,
  Filter,
  X,
  Edit2,
  Download,
  Upload,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import {
  wmsService,
  type StockLevel,
  type StockMovement,
  type Warehouse,
  type LowStockAlert,
} from '@/services/wms.service';
import { useGlobalLanguage } from '@/hooks/useLanguage';

type ViewMode = 'dashboard' | 'stock' | 'movements' | 'alerts' | 'warehouses';

export function WMSPage() {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [alertsData, warehousesData] = await Promise.all([
        wmsService.getLowStockAlerts({ acknowledged: false }),
        wmsService.getWarehouses(),
      ]);
      setAlerts(alertsData);
      setWarehouses(warehousesData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeDashboardAlert = async (alertId: string) => {
    try {
      await wmsService.acknowledgeAlert(alertId);
      await loadDashboardData();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert(tr('Nu am putut confirma alerta', 'Failed to acknowledge alert'));
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">
            {tr('Management depozit', 'Warehouse management')}
          </h1>
          <p className="text-text-secondary mt-1">
            {tr(
              'Gestioneaza inventarul, miscarile de stoc si operatiunile de depozit.',
              'Manage inventory, stock movements, and warehouse operations.',
            )}
          </p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-border-primary">
        <button
          onClick={() => setViewMode('dashboard')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'dashboard'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tr('Panou', 'Dashboard')}
        </button>
        <button
          onClick={() => setViewMode('stock')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'stock'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tr('Niveluri stoc', 'Stock levels')}
        </button>
        <button
          onClick={() => setViewMode('alerts')}
          className={`px-4 py-3 font-medium text-sm transition-colors relative ${
            viewMode === 'alerts'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tr('Alerte', 'Alerts')}
          {alerts.filter((a) => !a.acknowledged).length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {alerts.filter((a) => !a.acknowledged).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('movements')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'movements'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tr('Miscari', 'Movements')}
        </button>
        <button
          onClick={() => setViewMode('warehouses')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'warehouses'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tr('Depozite', 'Warehouses')}
        </button>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <DashboardView
          alerts={alerts}
          warehouses={warehouses}
          onRefresh={loadDashboardData}
          onViewAlerts={() => setViewMode('alerts')}
          onAcknowledgeAlert={acknowledgeDashboardAlert}
        />
      )}

      {/* Stock Levels View */}
      {viewMode === 'stock' && <StockLevelsView />}

      {/* Alerts View */}
      {viewMode === 'alerts' && <AlertsView onRefresh={loadDashboardData} />}

      {/* Movements View */}
      {viewMode === 'movements' && <MovementsView />}

      {/* Warehouses View */}
      {viewMode === 'warehouses' && (
        <WarehousesView warehouses={warehouses} onRefresh={loadDashboardData} />
      )}
    </div>
  );
}

// Dashboard View Component
function DashboardView({
  alerts,
  warehouses,
  onRefresh,
  onViewAlerts,
  onAcknowledgeAlert,
}: {
  alerts: LowStockAlert[];
  warehouses: Warehouse[];
  onRefresh: () => void;
  onViewAlerts: () => void;
  onAcknowledgeAlert: (alertId: string) => Promise<void>;
}) {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const criticalAlerts = alerts.filter((a) => a.severity === 'high' && !a.acknowledged);
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">{tr('Depozite', 'Warehouses')}</p>
              <p className="text-2xl font-bold text-text-primary">{warehouses.length}</p>
            </div>
            <WarehouseIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">{tr('Total alerte', 'Total alerts')}</p>
              <p className="text-2xl font-bold text-text-primary">{unacknowledgedAlerts.length}</p>
            </div>
            <AlertTriangle size={24} className="text-yellow-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">{tr('Critice', 'Critical')}</p>
              <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
            </div>
            <XCircle size={24} className="text-red-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">{tr('Confirmate', 'Acknowledged')}</p>
              <p className="text-2xl font-bold text-green-600">
                {alerts.filter((a) => a.acknowledged).length}
              </p>
            </div>
            <CheckCircle2 size={24} className="text-green-500" />
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle size={20} />
              {tr('Alerte critice de stoc', 'Critical stock alerts')}
            </h3>
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {criticalAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between bg-white dark:bg-surface-primary rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-text-primary">{alert.productName}</p>
                  <p className="text-sm text-text-secondary">
                    {tr('Curent', 'Current')}: {alert.currentStock} / {tr('Prag', 'Reorder')}:{' '}
                    {alert.reorderPoint} ({tr('Lipsa', 'Shortage')}: {alert.shortage})
                  </p>
                </div>
                <button
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg text-red-600"
                >
                  <CheckCircle2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {criticalAlerts.length > 5 && (
            <button onClick={onViewAlerts} className="mt-4 text-sm text-red-600 hover:underline">
              {tr('Vezi toate', 'View all')} {criticalAlerts.length}{' '}
              {tr('alerte critice', 'critical alerts')}
            </button>
          )}
        </div>
      )}

      {/* Recent Warehouses */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          {tr('Depozite', 'Warehouses')}
        </h3>
        {warehouses.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon size={48} className="text-text-tertiary" />}
            title={tr('Nu exista depozite', 'No warehouses')}
            description={tr(
              'Adauga depozite pentru a gestiona stocul pe mai multe locatii.',
              'Add warehouses to manage inventory across locations.',
            )}
            variant="compact"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map((warehouse) => (
              <div key={warehouse.id} className="bg-surface-secondary rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <WarehouseIcon size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{warehouse.name}</p>
                    {warehouse.address && (
                      <p className="text-xs text-text-tertiary">{warehouse.address}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Stock Levels View Component
function StockLevelsView() {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);
  const [adjustData, setAdjustData] = useState({
    quantity: 0,
    reason: '',
  });

  useEffect(() => {
    loadStockLevels();
  }, [page, statusFilter]);

  const loadStockLevels = async () => {
    try {
      setLoading(true);
      const data = await wmsService.getStockLevels({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setStockLevels(data.items);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error loading stock levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadStockLevels();
  };

  const handleAdjustStock = () => {
    if (!selectedStock || adjustData.quantity === 0 || !adjustData.reason) {
      alert(tr('Completeaza toate campurile', 'Please fill in all fields'));
      return;
    }
    wmsService
      .adjustStock({
        productId: selectedStock.productId,
        warehouseId: selectedStock.warehouseId,
        quantity: adjustData.quantity,
        reason: adjustData.reason,
      })
      .then(() => {
        alert(tr('Stocul a fost ajustat cu succes', 'Stock adjusted successfully'));
        setShowAdjustModal(false);
        setAdjustData({ quantity: 0, reason: '' });
        loadStockLevels();
      })
      .catch((error) => {
        console.error('Error adjusting stock:', error);
        alert(tr('Nu am putut ajusta stocul', 'Failed to adjust stock'));
      });
  };

  const getStatusConfig = (status: string) => {
    if (status === 'Critic') return { label: tr('Critic', 'Critical'), color: 'red' };
    if (status === 'Atentionare') return { label: tr('Stoc scazut', 'Low stock'), color: 'yellow' };
    return { label: tr('Normal', 'Normal'), color: 'green' };
  };

  const columns: Column<StockLevel>[] = [
    {
      key: 'name',
      label: tr('Produs', 'Product'),
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.imageUrl && (
            <img src={row.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />
          )}
          <div>
            <p className="font-medium text-text-primary">{value}</p>
            <p className="text-xs text-text-tertiary font-mono">{row.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'warehouseName',
      label: tr('Depozit', 'Warehouse'),
      render: (value) => value || tr('Principal', 'Main'),
    },
    {
      key: 'current',
      label: tr('In stoc', 'On hand'),
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reserved',
      label: tr('Rezervat', 'Reserved'),
      render: (value) => <span className="font-mono text-text-secondary">{value}</span>,
    },
    {
      key: 'available',
      label: tr('Disponibil', 'Available'),
      render: (value) => <span className="font-mono font-semibold text-primary-600">{value}</span>,
    },
    {
      key: 'reorderPoint',
      label: tr('Prag reaprovizionare', 'Reorder point'),
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'status',
      label: tr('Status', 'Status'),
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'id',
      label: tr('Actiuni', 'Actions'),
      render: (_, row) => (
        <button
          onClick={() => {
            setSelectedStock(row);
            setShowAdjustModal(true);
          }}
          className="p-2 hover:bg-surface-secondary rounded-lg transition-colors text-primary-600"
          title={tr('Ajusteaza stoc', 'Adjust stock')}
        >
          <Edit2 size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              size={18}
            />
            <input
              type="text"
              placeholder={tr('Cauta produse...', 'Search products...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          >
            <option value="all">{tr('Toate statusurile', 'All statuses')}</option>
            <option value="normal">{tr('Normal', 'Normal')}</option>
            <option value="warning">{tr('Stoc scazut', 'Low stock')}</option>
            <option value="critical">{tr('Critic', 'Critical')}</option>
          </select>
          <button onClick={handleSearch} className="btn-secondary">
            <Filter size={18} className="mr-2" />
            {tr('Filtreaza', 'Filter')}
          </button>
          <button onClick={loadStockLevels} className="btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stock Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : stockLevels.length === 0 ? (
          <EmptyState
            icon={<Package size={48} className="text-text-tertiary" />}
            title={tr('Nu exista date de stoc', 'No stock data found')}
            description={
              searchTerm
                ? tr('Incearca sa ajustezi cautarea.', 'Try adjusting your search.')
                : tr('Nu exista niveluri de stoc disponibile.', 'No stock levels available.')
            }
            variant="compact"
          />
      ) : (
        <>
          <DataTable columns={columns} data={stockLevels} />
          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                {tr('Afisez', 'Showing')} {(page - 1) * limit + 1} {tr('pana la', 'to')}{' '}
                {Math.min(page * limit, total)} {tr('din', 'of')} {total} {tr('articole', 'items')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 btn-secondary disabled:opacity-50"
                >
                  {tr('Anterior', 'Previous')}
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="px-4 py-2 btn-secondary disabled:opacity-50"
                >
                  {tr('Urmator', 'Next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {tr('Ajusteaza stoc', 'Adjust stock')}
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-2 hover:bg-surface-secondary rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-surface-secondary rounded-lg p-4">
                <p className="font-medium text-text-primary">{selectedStock.name}</p>
                <p className="text-sm text-text-secondary">SKU: {selectedStock.sku}</p>
                <p className="text-sm text-text-secondary">
                  {tr('Disponibil curent', 'Current available')}: {selectedStock.available}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {tr('Cantitate ajustare', 'Adjustment amount')}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={adjustData.quantity < 0 ? 'remove' : 'add'}
                    onChange={(e) => {
                      const absQty = Math.abs(adjustData.quantity);
                      setAdjustData({
                        ...adjustData,
                        quantity: e.target.value === 'remove' ? -absQty : absQty,
                      });
                    }}
                    className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  >
                    <option value="add">{tr('Adauga', 'Add')}</option>
                    <option value="remove">{tr('Scade', 'Remove')}</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={Math.abs(adjustData.quantity)}
                    onChange={(e) => {
                      const absQty = parseInt(e.target.value) || 0;
                      setAdjustData({
                        ...adjustData,
                        quantity: adjustData.quantity < 0 ? -absQty : absQty,
                      });
                    }}
                    className="flex-1 px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {tr('Motiv', 'Reason')}
                </label>
                <textarea
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  rows={3}
                  placeholder={tr('Introdu motivul ajustarii...', 'Enter reason for adjustment...')}
                  required
                />
              </div>
            </div>
            <div className="p-6 border-t border-border-primary flex gap-3">
              <button onClick={() => setShowAdjustModal(false)} className="btn-secondary flex-1">
                {tr('Anuleaza', 'Cancel')}
              </button>
              <button onClick={handleAdjustStock} className="btn-primary flex-1">
                {tr('Ajusteaza stoc', 'Adjust stock')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Alerts View Component
function AlertsView({ onRefresh }: { onRefresh: () => void }) {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'acknowledged'>('unacknowledged');

  useEffect(() => {
    loadAlerts();
  }, [filter]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await wmsService.getLowStockAlerts({
        acknowledged:
          filter === 'unacknowledged' ? false : filter === 'acknowledged' ? true : undefined,
      });
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await wmsService.acknowledgeAlert(alertId);
      loadAlerts();
      onRefresh();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert(tr('Nu am putut confirma alerta', 'Failed to acknowledge alert'));
    }
  };

  const getSeverityConfig = (severity: string) => {
    if (severity === 'high') return { label: tr('Ridicata', 'High'), color: 'red' };
    if (severity === 'medium') return { label: tr('Medie', 'Medium'), color: 'yellow' };
    return { label: tr('Scazuta', 'Low'), color: 'blue' };
  };

  const columns: Column<LowStockAlert>[] = [
    {
      key: 'productName',
      label: tr('Produs', 'Product'),
    },
    {
      key: 'currentStock',
      label: tr('Curent', 'Current'),
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reorderPoint',
      label: tr('Prag reaprovizionare', 'Reorder point'),
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'shortage',
      label: tr('Lipsa', 'Shortage'),
      render: (value) => <span className="font-mono font-semibold text-red-600">{value}</span>,
    },
    {
      key: 'severity',
      label: tr('Severitate', 'Severity'),
      render: (value) => {
        const config = getSeverityConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'acknowledged',
      label: tr('Status', 'Status'),
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-yellow-600'}>
          {value ? tr('Confirmata', 'Acknowledged') : tr('In asteptare', 'Pending')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: tr('Creata la', 'Created'),
      render: (value) => new Date(value).toLocaleDateString(locale),
    },
    {
      key: 'id',
      label: tr('Actiuni', 'Actions'),
      render: (_, row) =>
        !row.acknowledged && (
          <button
            onClick={() => handleAcknowledge(row.id)}
            className="p-2 hover:bg-green-500/10 text-green-600 rounded-lg"
            title={tr('Confirma', 'Acknowledge')}
          >
            <CheckCircle2 size={16} />
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-primary-600 text-white' : 'bg-surface-secondary'
            }`}
          >
            {tr('Toate', 'All')}
          </button>
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'unacknowledged' ? 'bg-yellow-600 text-white' : 'bg-surface-secondary'
            }`}
          >
            {tr('Neconfirmate', 'Unacknowledged')}
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'acknowledged' ? 'bg-green-600 text-white' : 'bg-surface-secondary'
            }`}
          >
            {tr('Confirmate', 'Acknowledged')}
          </button>
        </div>
        <button onClick={loadAlerts} className="btn-secondary">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Alerts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : alerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={48} className="text-text-tertiary" />}
            title={tr('Nu exista alerte', 'No alerts')}
            description={tr('Toate nivelurile de stoc sunt bune.', 'All stock levels are healthy.')}
            variant="compact"
          />
      ) : (
        <DataTable columns={columns} data={alerts} />
      )}
    </div>
  );
}

// Movements View Component
function MovementsView() {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSku, setProductSku] = useState('');
  const [lookupError, setLookupError] = useState('');

  const loadMovements = async (productReference: string) => {
    const normalizedReference = productReference.trim();
    if (!normalizedReference) {
      setLookupError(tr('Introdu SKU sau ID produs.', 'Please enter a product SKU or ID.'));
      return;
    }

    try {
      setLookupError('');
      setLoading(true);
      setMovements([]);
      setSelectedProductId(null);
      const data = await wmsService.getMovementHistory(normalizedReference);
      setMovements(data);
      setSelectedProductId(normalizedReference);
    } catch (error) {
      console.error('Error loading movements:', error);
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : '';
      if (rawMessage.includes('not found')) {
        setLookupError(
          tr(
            'Nu am gasit niciun produs pentru SKU/ID-ul introdus.',
            'No product found for the provided SKU/ID.',
          ),
        );
      } else {
        setLookupError(tr('Nu am putut incarca miscarile de stoc.', 'Failed to load stock movements.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewMovements = () => {
    void loadMovements(productSku);
  };

  const getMovementTypeConfig = (type: string) => {
    if (type === 'IN') return { label: tr('Intrare stoc', 'Stock in'), icon: TrendingUp, color: 'green' };
    if (type === 'OUT') return { label: tr('Iesire stoc', 'Stock out'), icon: TrendingDown, color: 'red' };
    if (type === 'ADJUSTMENT') return { label: tr('Ajustare', 'Adjustment'), icon: Edit2, color: 'blue' };
    if (type === 'RESERVATION') return { label: tr('Rezervare', 'Reserved'), icon: Package, color: 'yellow' };
    if (type === 'RELEASE') return { label: tr('Eliberare', 'Released'), icon: CheckCircle2, color: 'purple' };
    return { label: type, icon: History, color: 'gray' };
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'movementType',
      label: tr('Tip', 'Type'),
      render: (value) => {
        const config = getMovementTypeConfig(value);
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <Icon size={16} className={`text-${config.color}-600`} />
            <StatusBadge status={config.color} label={config.label} />
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: tr('Cantitate', 'Quantity'),
      render: (value, row) => {
        const isNegative = row.movementType === 'OUT';
        return (
          <span className={`font-mono ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
            {isNegative ? '-' : '+'}
            {value}
          </span>
        );
      },
    },
    {
      key: 'quantityAfter',
      label: tr('Sold dupa', 'Balance after'),
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reason',
      label: tr('Motiv', 'Reason'),
      render: (value) => value || '-',
    },
    {
      key: 'referenceId',
      label: tr('Referinta', 'Reference'),
      render: (value) => <span className="font-mono text-xs">{value || '-'}</span>,
    },
    {
      key: 'createdAt',
      label: tr('Data', 'Date'),
      render: (value) => new Date(value).toLocaleString(locale),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Search by Product */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              size={18}
            />
            <input
              type="text"
              placeholder={tr('Introdu SKU sau ID produs...', 'Enter product SKU or ID...')}
              value={productSku}
              onChange={(e) => {
                setProductSku(e.target.value);
                if (lookupError) {
                  setLookupError('');
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleViewMovements()}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg font-mono"
            />
          </div>
          <button onClick={handleViewMovements} disabled={!productSku.trim()} className="btn-primary">
            {tr('Vezi miscari', 'View movements')}
          </button>
        </div>
        {lookupError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {lookupError}
          </div>
        )}
      </div>

      {/* Movements Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !selectedProductId ? (
          <EmptyState
            icon={<History size={48} className="text-text-tertiary" />}
            title={tr('Introdu SKU sau ID produs', 'Enter product SKU or ID')}
            description={tr(
              'Cauta un produs pentru a vedea istoricul miscarilor.',
              'Search for a product to view its movement history.',
            )}
            variant="compact"
          />
      ) : movements.length === 0 ? (
        <EmptyState
          icon={<History size={48} className="text-text-tertiary" />}
          title={tr('Nu exista miscari', 'No movements found')}
          description={tr(
            'Nu exista miscari de stoc inregistrate pentru acest produs.',
            'No stock movements recorded for this product.',
          )}
          variant="compact"
        />
      ) : (
        <DataTable columns={columns} data={movements} />
      )}
    </div>
  );
}

// Warehouses View Component
function WarehousesView({
  warehouses,
  onRefresh,
}: {
  warehouses: Warehouse[];
  onRefresh: () => void;
}) {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });

  const handleAddWarehouse = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await wmsService.createWarehouse({
        name: formData.name,
        address: formData.address,
      });
      setFormData({ name: '', address: '' });
      setShowAddModal(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to create warehouse:', error);
      alert(tr('Nu am putut crea depozitul. Incearca din nou.', 'Could not create warehouse. Try again.'));
    }
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      label: tr('Nume', 'Name'),
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <WarehouseIcon size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-text-primary">{value}</p>
            {row.address && <p className="text-xs text-text-tertiary">{row.address}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: tr('Status', 'Status'),
      render: (value) => (
        <StatusBadge
          status={value ? 'green' : 'gray'}
          label={value ? tr('Activ', 'Active') : tr('Inactiv', 'Inactive')}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{tr('Depozite', 'Warehouses')}</h2>
          <p className="text-sm text-text-tertiary">
            {warehouses.length} {tr('locatii', 'locations')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="btn-secondary">
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            {tr('Adauga depozit', 'Add warehouse')}
          </button>
        </div>
      </div>

      {/* Warehouses Table */}
      {warehouses.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon size={48} className="text-text-tertiary" />}
            title={tr('Nu exista depozite', 'No warehouses')}
            description={tr(
              'Adauga depozite pentru a gestiona inventarul in mai multe locatii.',
              'Add warehouses to manage your inventory across locations.',
            )}
            actionLabel={tr('Adauga depozit', 'Add warehouse')}
            onAction={() => setShowAddModal(true)}
          />
      ) : (
        <DataTable columns={columns} data={warehouses} />
      )}

      {/* Add Warehouse Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                {tr('Adauga depozit', 'Add warehouse')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-surface-secondary rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWarehouse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {tr('Nume', 'Name')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  placeholder={tr('ex: Depozit principal Bucuresti', 'e.g., Bucharest Main Warehouse')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {tr('Adresa', 'Address')}
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  rows={3}
                  placeholder={tr('Introdu adresa depozitului...', 'Enter warehouse address...')}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  {tr('Anuleaza', 'Cancel')}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {tr('Adauga depozit', 'Add warehouse')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
