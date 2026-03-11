import { useState, useEffect } from 'react';
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

type ViewMode = 'dashboard' | 'stock' | 'movements' | 'alerts' | 'warehouses';

export function WMSPage() {
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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Warehouse Management</h1>
          <p className="text-text-secondary mt-1">
            Manage inventory, stock movements, and warehouse operations
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
          Dashboard
        </button>
        <button
          onClick={() => setViewMode('stock')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'stock'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Stock Levels
        </button>
        <button
          onClick={() => setViewMode('alerts')}
          className={`px-4 py-3 font-medium text-sm transition-colors relative ${
            viewMode === 'alerts'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Alerts
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
          Movements
        </button>
        <button
          onClick={() => setViewMode('warehouses')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'warehouses'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Warehouses
        </button>
      </div>

      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <DashboardView
          alerts={alerts}
          warehouses={warehouses}
          onRefresh={loadDashboardData}
          onViewAlerts={() => setViewMode('alerts')}
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
}: {
  alerts: LowStockAlert[];
  warehouses: Warehouse[];
  onRefresh: () => void;
  onViewAlerts: () => void;
}) {
  const criticalAlerts = alerts.filter((a) => a.severity === 'high' && !a.acknowledged);
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Warehouses</p>
              <p className="text-2xl font-bold text-text-primary">{warehouses.length}</p>
            </div>
            <WarehouseIcon size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Total Alerts</p>
              <p className="text-2xl font-bold text-text-primary">{unacknowledgedAlerts.length}</p>
            </div>
            <AlertTriangle size={24} className="text-yellow-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Critical</p>
              <p className="text-2xl font-bold text-red-600">{criticalAlerts.length}</p>
            </div>
            <XCircle size={24} className="text-red-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Acknowledged</p>
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
              Critical Stock Alerts
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
                    Current: {alert.currentStock} / Reorder: {alert.reorderPoint} (Shortage:{' '}
                    {alert.shortage})
                  </p>
                </div>
                <button
                  onClick={() => {
                    /* TODO: acknowledge alert */
                  }}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-800 rounded-lg text-red-600"
                >
                  <CheckCircle2 size={16} />
                </button>
              </div>
            ))}
          </div>
          {criticalAlerts.length > 5 && (
            <button onClick={onViewAlerts} className="mt-4 text-sm text-red-600 hover:underline">
              View all {criticalAlerts.length} critical alerts
            </button>
          )}
        </div>
      )}

      {/* Recent Warehouses */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Warehouses</h3>
        {warehouses.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon size={48} className="text-text-tertiary" />}
            title="No Warehouses"
            description="Add warehouses to manage your inventory across locations."
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

  const filteredStockLevels = stockLevels.filter((stock) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'normal') return stock.status === 'Normal';
    if (statusFilter === 'warning') return stock.status === 'Atentionare';
    if (statusFilter === 'critical') return stock.status === 'Critic';
    return true;
  });

  const handleAdjustStock = () => {
    if (!selectedStock || adjustData.quantity === 0 || !adjustData.reason) {
      alert('Please fill in all fields');
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
        alert('Stock adjusted successfully');
        setShowAdjustModal(false);
        setAdjustData({ quantity: 0, reason: '' });
        loadStockLevels();
      })
      .catch((error) => {
        console.error('Error adjusting stock:', error);
        alert('Failed to adjust stock');
      });
  };

  const getStatusConfig = (status: string) => {
    if (status === 'Critic') return { label: 'Critical', color: 'red' };
    if (status === 'Atentionare') return { label: 'Low Stock', color: 'yellow' };
    return { label: 'Normal', color: 'green' };
  };

  const columns: Column<StockLevel>[] = [
    {
      key: 'name',
      label: 'Product',
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
      label: 'Warehouse',
      render: (value) => value || 'Principal',
    },
    {
      key: 'current',
      label: 'On Hand',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reserved',
      label: 'Reserved',
      render: (value) => <span className="font-mono text-text-secondary">{value}</span>,
    },
    {
      key: 'available',
      label: 'Available',
      render: (value) => <span className="font-mono font-semibold text-primary-600">{value}</span>,
    },
    {
      key: 'reorderPoint',
      label: 'Reorder Point',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => {
        const config = getStatusConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => {
            setSelectedStock(row);
            setShowAdjustModal(true);
          }}
          className="p-2 hover:bg-surface-secondary rounded-lg transition-colors text-primary-600"
          title="Adjust stock"
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
              placeholder="Search products..."
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
            <option value="all">All Status</option>
            <option value="normal">Normal</option>
            <option value="warning">Low Stock</option>
            <option value="critical">Critical</option>
          </select>
          <button onClick={handleSearch} className="btn-secondary">
            <Filter size={18} className="mr-2" />
            Filter
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
      ) : filteredStockLevels.length === 0 ? (
        <EmptyState
          icon={<Package size={48} className="text-text-tertiary" />}
          title="No Stock Data Found"
          description={searchTerm ? 'Try adjusting your search.' : 'No stock levels available.'}
          variant="compact"
        />
      ) : (
        <>
          <DataTable columns={columns} data={filteredStockLevels} />
          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} items
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= total}
                  className="px-4 py-2 btn-secondary disabled:opacity-50"
                >
                  Next
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
              <h3 className="text-lg font-semibold text-text-primary">Adjust Stock</h3>
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
                  Current Available: {selectedStock.available}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Adjustment Amount
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
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
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
                <label className="block text-sm font-medium text-text-secondary mb-2">Reason</label>
                <textarea
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  rows={3}
                  placeholder="Enter reason for adjustment..."
                  required
                />
              </div>
            </div>
            <div className="p-6 border-t border-border-primary flex gap-3">
              <button onClick={() => setShowAdjustModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleAdjustStock} className="btn-primary flex-1">
                Adjust Stock
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
      alert('Failed to acknowledge alert');
    }
  };

  const getSeverityConfig = (severity: string) => {
    if (severity === 'high') return { label: 'High', color: 'red' };
    if (severity === 'medium') return { label: 'Medium', color: 'yellow' };
    return { label: 'Low', color: 'blue' };
  };

  const columns: Column<LowStockAlert>[] = [
    {
      key: 'productName',
      label: 'Product',
    },
    {
      key: 'currentStock',
      label: 'Current',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reorderPoint',
      label: 'Reorder Point',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'shortage',
      label: 'Shortage',
      render: (value) => <span className="font-mono font-semibold text-red-600">{value}</span>,
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value) => {
        const config = getSeverityConfig(value);
        return <StatusBadge status={config.color} label={config.label} />;
      },
    },
    {
      key: 'acknowledged',
      label: 'Status',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-yellow-600'}>
          {value ? 'Acknowledged' : 'Pending'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) =>
        !row.acknowledged && (
          <button
            onClick={() => handleAcknowledge(row.id)}
            className="p-2 hover:bg-green-500/10 text-green-600 rounded-lg"
            title="Acknowledge"
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
            All
          </button>
          <button
            onClick={() => setFilter('unacknowledged')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'unacknowledged' ? 'bg-yellow-600 text-white' : 'bg-surface-secondary'
            }`}
          >
            Unacknowledged
          </button>
          <button
            onClick={() => setFilter('acknowledged')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'acknowledged' ? 'bg-green-600 text-white' : 'bg-surface-secondary'
            }`}
          >
            Acknowledged
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
          title="No Alerts"
          description="All stock levels are healthy."
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
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSku, setProductSku] = useState('');

  const loadMovements = async (productId: string) => {
    try {
      setLoading(true);
      const data = await wmsService.getMovementHistory(productId);
      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMovementTypeConfig = (type: string) => {
    if (type === 'IN') return { label: 'Stock In', icon: TrendingUp, color: 'green' };
    if (type === 'OUT') return { label: 'Stock Out', icon: TrendingDown, color: 'red' };
    if (type === 'ADJUSTMENT') return { label: 'Adjustment', icon: Edit2, color: 'blue' };
    if (type === 'RESERVATION') return { label: 'Reserved', icon: Package, color: 'yellow' };
    if (type === 'RELEASE') return { label: 'Released', icon: CheckCircle2, color: 'purple' };
    return { label: type, icon: History, color: 'gray' };
  };

  const columns: Column<StockMovement>[] = [
    {
      key: 'movementType',
      label: 'Type',
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
      label: 'Quantity',
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
      label: 'Balance After',
      render: (value) => <span className="font-mono">{value}</span>,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (value) => value || '-',
    },
    {
      key: 'referenceId',
      label: 'Reference',
      render: (value) => <span className="font-mono text-xs">{value || '-'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (value) => new Date(value).toLocaleString('ro-RO'),
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
              placeholder="Enter Product SKU or ID..."
              value={productSku}
              onChange={(e) => setProductSku(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg font-mono"
            />
          </div>
          <button
            onClick={() => productSku && loadMovements(productSku)}
            disabled={!productSku}
            className="btn-primary"
          >
            View Movements
          </button>
        </div>
      </div>

      {/* Movements Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : !selectedProductId ? (
        <EmptyState
          icon={<History size={48} className="text-text-tertiary" />}
          title="Enter Product SKU"
          description="Search for a product to view its movement history."
          variant="compact"
        />
      ) : movements.length === 0 ? (
        <EmptyState
          icon={<History size={48} className="text-text-tertiary" />}
          title="No Movements Found"
          description="No stock movements recorded for this product."
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement add warehouse API
    alert('Add warehouse functionality coming soon');
    setShowAddModal(false);
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      label: 'Name',
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
      label: 'Status',
      render: (value) => (
        <StatusBadge status={value ? 'green' : 'gray'} label={value ? 'Active' : 'Inactive'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Warehouses</h2>
          <p className="text-sm text-text-tertiary">{warehouses.length} locations</p>
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
            Add Warehouse
          </button>
        </div>
      </div>

      {/* Warehouses Table */}
      {warehouses.length === 0 ? (
        <EmptyState
          icon={<WarehouseIcon size={48} className="text-text-tertiary" />}
          title="No Warehouses"
          description="Add warehouses to manage your inventory across locations."
          actionLabel="Add Warehouse"
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
              <h3 className="text-lg font-semibold text-text-primary">Add Warehouse</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-surface-secondary rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWarehouse} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  placeholder="e.g., Bucharest Main Warehouse"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  rows={3}
                  placeholder="Enter warehouse address..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
