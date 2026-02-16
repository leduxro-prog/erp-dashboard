import { useState, useEffect } from 'react';
import {
  Factory,
  Search,
  RefreshCw,
  Package,
  Link2,
  MapPin,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  X,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { suppliersService, type Supplier, type SupplierProduct, type SupplierStatistics, type SkuMapping } from '@/services/suppliers.service';

type ViewMode = 'list' | 'detail' | 'products' | 'mappings' | 'orders';

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const data = await suppliersService.getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      // In a real app, we'd filter client-side or call API with search param
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter suppliers by search term
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Select supplier
  const selectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setViewMode('detail');
  };

  // Back to list
  const goBack = () => {
    setSelectedSupplier(null);
    setViewMode('list');
  };

  // Sync all suppliers
  const syncAll = async () => {
    if (!confirm('Sync all suppliers? This may take a while.')) return;
    try {
      const result = await suppliersService.triggerSyncAll();
      alert(`Sync job queued: ${result.jobId}`);
    } catch (error) {
      console.error('Error syncing all:', error);
      alert('Failed to queue sync job');
    }
  };

  // Table columns
  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
            <Factory size={20} className="text-text-secondary" />
          </div>
          <div>
            <p className="font-medium text-text-primary">{value}</p>
            {row.contact_email && (
              <p className="text-xs text-text-tertiary">{row.contact_email}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Location',
      render: (value) => value || '-',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (value) => (
        <StatusBadge
          status={value ? 'active' : 'inactive'}
          label={value ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'last_sync_at',
      label: 'Last Sync',
      render: (value) => value ? new Date(value).toLocaleDateString('ro-RO') : 'Never',
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => selectSupplier(row)}
          className="p-2 hover:bg-surface-secondary rounded-lg transition-colors text-primary-600"
        >
          <Edit2 size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {viewMode === 'list' ? (
            <>
              <h1 className="text-3xl font-semibold text-text-primary">Suppliers</h1>
              <p className="text-text-secondary mt-1">Manage supplier relationships and product catalog</p>
            </>
          ) : (
            <>
              <button
                onClick={goBack}
                className="text-sm text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1"
              >
                ← Back to Suppliers
              </button>
              <h1 className="text-3xl font-semibold text-text-primary">{selectedSupplier?.name}</h1>
              <p className="text-text-secondary mt-1">{selectedSupplier?.contact_email}</p>
            </>
          )}
        </div>
        {viewMode === 'list' && (
          <button onClick={syncAll} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={18} />
            Sync All
          </button>
        )}
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {/* Search */}
          <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
            <div className="relative max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                size={18}
              />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Suppliers Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState
              icon={<Factory size={48} className="text-text-tertiary" />}
              title="No Suppliers Found"
              description={searchTerm ? 'Try adjusting your search terms.' : 'Add suppliers to start managing your supply chain.'}
              variant="compact"
            />
          ) : (
            <DataTable columns={columns} data={filteredSuppliers} />
          )}
        </>
      )}

      {/* Detail View */}
      {viewMode === 'detail' && selectedSupplier && (
        <SupplierDetailView
          supplier={selectedSupplier}
          onBack={goBack}
          onViewProducts={() => setViewMode('products')}
          onViewMappings={() => setViewMode('mappings')}
          onViewOrders={() => setViewMode('orders')}
          onSync={() => fetchSuppliers()}
        />
      )}

      {/* Products View */}
      {viewMode === 'products' && selectedSupplier && (
        <SupplierProductsView
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          onBack={() => setViewMode('detail')}
          onSync={fetchSuppliers}
        />
      )}

      {/* Mappings View */}
      {viewMode === 'mappings' && selectedSupplier && (
        <SkuMappingsView
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          onBack={() => setViewMode('detail')}
        />
      )}

      {/* Orders View */}
      {viewMode === 'orders' && selectedSupplier && (
        <SupplierOrdersView
          supplierId={selectedSupplier.id}
          supplierName={selectedSupplier.name}
          onBack={() => setViewMode('detail')}
        />
      )}
    </div>
  );
}

// Supplier Detail View Component
function SupplierDetailView({
  supplier,
  onBack,
  onViewProducts,
  onViewMappings,
  onViewOrders,
  onSync,
}: {
  supplier: Supplier;
  onBack: () => void;
  onViewProducts: () => void;
  onViewMappings: () => void;
  onViewOrders: () => void;
  onSync: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SupplierStatistics | null>(null);

  useEffect(() => {
    loadStats();
  }, [supplier.id]);

  const loadStats = async () => {
    try {
      const data = await suppliersService.getSupplierStatistics(supplier.id);
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await suppliersService.triggerSync(supplier.id);
      alert('Sync triggered successfully');
      loadStats();
      onSync();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync supplier');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={onViewProducts}
          className="bg-surface-primary border border-border-primary rounded-xl p-4 flex items-center gap-3 hover:border-primary-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Package size={20} className="text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-text-primary">Products</p>
            <p className="text-sm text-text-tertiary">{stats?.total_products || 0} items</p>
          </div>
        </button>

        <button
          onClick={onViewMappings}
          className="bg-surface-primary border border-border-primary rounded-xl p-4 flex items-center gap-3 hover:border-primary-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Link2 size={20} className="text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-text-primary">SKU Mappings</p>
            <p className="text-sm text-text-tertiary">Map supplier SKUs</p>
          </div>
        </button>

        <button
          onClick={onViewOrders}
          className="bg-surface-primary border border-border-primary rounded-xl p-4 flex items-center gap-3 hover:border-primary-500 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <ShoppingCart size={20} className="text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-text-primary">Orders</p>
            <p className="text-sm text-text-tertiary">View purchase orders</p>
          </div>
        </button>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-surface-primary border border-border-primary rounded-xl p-4 flex items-center gap-3 hover:border-primary-500 transition-colors"
        >
          <div className={`w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center ${syncing ? 'animate-spin' : ''}`}>
            <RefreshCw size={20} className="text-primary-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-text-primary">Sync Now</p>
            <p className="text-sm text-text-tertiary">{supplier.last_sync_at ? 'Last: ' + new Date(supplier.last_sync_at).toLocaleDateString('ro-RO') : 'Never synced'}</p>
          </div>
        </button>
      </div>

      {/* Supplier Information */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Supplier Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-text-tertiary" />
              <div>
                <p className="text-xs text-text-tertiary">Email</p>
                <p className="text-text-primary">{supplier.contact_email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-text-tertiary" />
              <div>
                <p className="text-xs text-text-tertiary">Phone</p>
                <p className="text-text-primary">{supplier.contact_phone || '-'}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-text-tertiary" />
              <div>
                <p className="text-xs text-text-tertiary">Address</p>
                <p className="text-text-primary">{supplier.address || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-text-tertiary" />
              <div>
                <p className="text-xs text-text-tertiary">Website</p>
                {supplier.website ? (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {supplier.website}
                  </a>
                ) : (
                  <p className="text-text-primary">-</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Product Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-surface-secondary rounded-lg">
              <p className="text-2xl font-bold text-text-primary">{stats.total_products}</p>
              <p className="text-sm text-text-tertiary">Total Products</p>
            </div>
            <div className="text-center p-4 bg-green-500/5 rounded-lg border border-green-500/20">
              <p className="text-2xl font-bold text-green-600">{stats.in_stock}</p>
              <p className="text-sm text-text-tertiary">In Stock</p>
            </div>
            <div className="text-center p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-600">{stats.low_stock}</p>
              <p className="text-sm text-text-tertiary">Low Stock</p>
            </div>
            <div className="text-center p-4 bg-red-500/5 rounded-lg border border-red-500/20">
              <p className="text-2xl font-bold text-red-600">{stats.out_of_stock}</p>
              <p className="text-sm text-text-tertiary">Out of Stock</p>
            </div>
          </div>
          {stats.categories && stats.categories.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-text-secondary mb-3">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {stats.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-surface-secondary rounded-full text-sm text-text-secondary"
                  >
                    {cat.category} ({cat.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Supplier Products View Component
function SupplierProductsView({
  supplierId,
  supplierName,
  onBack,
  onSync,
}: {
  supplierId: string;
  supplierName: string;
  onBack: () => void;
  onSync: () => void;
}) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');

  useEffect(() => {
    loadProducts();
  }, [supplierId, stockFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (stockFilter === 'in-stock') params.minStock = 10;
      if (stockFilter === 'low-stock') {
        params.minStock = 1;
        // In a real app, we'd add maxStock filter
      }

      const data = await suppliersService.getSupplierProducts(supplierId, params);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      await suppliersService.triggerSync(supplierId);
      alert('Sync triggered');
      loadProducts();
      onSync();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync');
    }
  };

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', color: 'red' };
    if (qty < 10) return { label: 'Low Stock', color: 'yellow' };
    return { label: 'In Stock', color: 'green' };
  };

  const filteredProducts = products.filter(p => {
    if (stockFilter === 'out-of-stock') return p.stock_quantity === 0;
    if (stockFilter === 'low-stock') return p.stock_quantity > 0 && p.stock_quantity < 10;
    if (stockFilter === 'in-stock') return p.stock_quantity >= 10;
    return true;
  });

  const columns: Column<SupplierProduct>[] = [
    {
      key: 'name',
      label: 'Product',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.image_url && (
            <img src={row.image_url} alt="" className="w-10 h-10 rounded object-cover" />
          )}
          <div>
            <p className="font-medium text-text-primary">{value}</p>
            <p className="text-xs text-text-tertiary font-mono">{row.supplier_sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      render: (value) => {
        const status = getStockStatus(value);
        return (
          <StatusBadge status={status.color} label={`${value} (${status.label})`} />
        );
      },
    },
    {
      key: 'price',
      label: 'Price',
      render: (value, row) => (
        <span className="font-medium">
          {value?.toFixed(2) || '-'} {row.currency || '-'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (value) => value || '-',
    },
    {
      key: 'last_synced',
      label: 'Last Synced',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{supplierName} Products</h2>
          <p className="text-sm text-text-tertiary">{products.length} products</p>
        </div>
        <button onClick={handleSync} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={18} />
          Sync Products
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
          />
        </div>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as any)}
          className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
        >
          <option value="all">All Stock Levels</option>
          <option value="in-stock">In Stock (10+)</option>
          <option value="low-stock">Low Stock (1-9)</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={<Package size={48} className="text-text-tertiary" />}
          title="No Products Found"
          description={searchTerm ? 'Try adjusting your search.' : 'No products available from this supplier.'}
          variant="compact"
        />
      ) : (
        <DataTable columns={columns} data={filteredProducts} />
      )}
    </div>
  );
}

// SKU Mappings View Component
function SkuMappingsView({
  supplierId,
  supplierName,
  onBack,
}: {
  supplierId: string;
  supplierName: string;
  onBack: () => void;
}) {
  const [mappings, setMappings] = useState<SkuMapping[]>([]);
  const [unmappedProducts, setUnmappedProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    supplierSku: '',
    internalProductId: '',
    internalSku: '',
  });

  useEffect(() => {
    loadData();
  }, [supplierId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mappingsData, unmappedData] = await Promise.all([
        suppliersService.getSkuMappings(supplierId),
        suppliersService.getUnmappedProducts(supplierId),
      ]);
      setMappings(mappingsData);
      setUnmappedProducts(unmappedData);
    } catch (error) {
      console.error('Error loading mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await suppliersService.createSkuMapping(supplierId, formData);
      alert('Mapping created successfully');
      setShowAddModal(false);
      setFormData({ supplierSku: '', internalProductId: '', internalSku: '' });
      loadData();
    } catch (error) {
      console.error('Error creating mapping:', error);
      alert('Failed to create mapping');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Delete this SKU mapping?')) return;
    try {
      await suppliersService.deleteSkuMapping(mappingId);
      loadData();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Failed to delete mapping');
    }
  };

  const mappingColumns: Column<SkuMapping>[] = [
    {
      key: 'supplier_sku',
      label: 'Supplier SKU',
      render: (value) => <span className="font-mono text-sm">{value}</span>,
    },
    {
      key: 'internal_sku',
      label: 'Internal SKU',
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>,
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (value) => value || '-',
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => handleDeleteMapping(row.id)}
          className="p-2 hover:bg-red-500/10 text-red-600 rounded-lg"
        >
          <X size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">SKU Mappings</h2>
          <p className="text-sm text-text-tertiary">{mappings.length} mappings, {unmappedProducts.length} unmapped products</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Add Mapping
        </button>
      </div>

      {/* Existing Mappings */}
      <div className="bg-surface-primary border border-border-primary rounded-xl">
        <div className="p-4 border-b border-border-primary">
          <h3 className="font-semibold text-text-primary">Existing Mappings</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : mappings.length === 0 ? (
          <div className="p-12 text-center text-text-tertiary">
            <Link2 size={48} className="mx-auto mb-4 text-text-tertiary" />
            <p>No SKU mappings configured</p>
          </div>
        ) : (
          <DataTable columns={mappingColumns} data={mappings} />
        )}
      </div>

      {/* Unmapped Products */}
      {unmappedProducts.length > 0 && (
        <div className="bg-surface-primary border border-border-primary rounded-xl">
          <div className="p-4 border-b border-border-primary flex items-center justify-between">
            <h3 className="font-semibold text-text-primary">Unmapped Products</h3>
            <span className="text-sm text-yellow-600 flex items-center gap-1">
              <AlertCircle size={16} />
              {unmappedProducts.length} products without mappings
            </span>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {unmappedProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    setFormData({
                      supplierSku: product.supplier_sku,
                      internalProductId: product.id,
                      internalSku: '',
                    });
                    setShowAddModal(true);
                  }}
                  className="px-3 py-2 bg-surface-secondary rounded-lg text-sm hover:border-primary-500 border border-transparent transition-colors"
                >
                  {product.supplier_sku}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Mapping Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Add SKU Mapping</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-surface-secondary rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateMapping} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Supplier SKU</label>
                <input
                  type="text"
                  required
                  value={formData.supplierSku}
                  onChange={(e) => setFormData({ ...formData, supplierSku: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg font-mono"
                  placeholder="e.g., ML-LED-123"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Internal Product ID</label>
                <input
                  type="text"
                  value={formData.internalProductId}
                  onChange={(e) => setFormData({ ...formData, internalProductId: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                  placeholder="UUID or leave empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Internal SKU</label>
                <input
                  type="text"
                  value={formData.internalSku}
                  onChange={(e) => setFormData({ ...formData, internalSku: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg font-mono"
                  placeholder="e.g., LED-INT-001"
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
                  Create Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Supplier Orders View Component
function SupplierOrdersView({
  supplierId,
  supplierName,
  onBack,
}: {
  supplierId: string;
  supplierName: string;
  onBack: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [supplierId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await suppliersService.getSupplierOrders(supplierId);
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'order_number',
      label: 'Order #',
      render: (value) => <span className="font-mono">{value || '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status="blue" label={value} />,
    },
    {
      key: 'total_amount',
      label: 'Total',
      render: (value) => <span className="font-medium">{value?.toFixed(2) || '-'}</span>,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Supplier Orders</h2>
          <p className="text-sm text-text-tertiary">{orders.length} orders from {supplierName}</p>
        </div>
        <button
          onClick={() => setShowOrderModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Place Order
        </button>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={48} className="text-text-tertiary" />}
          title="No Orders Yet"
          description="Place your first order with this supplier."
          variant="compact"
        />
      ) : (
        <DataTable columns={columns} data={orders} />
      )}

      {/* Place Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-primary rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-border-primary flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Place Supplier Order</h3>
              <button onClick={() => setShowOrderModal(false)} className="p-2 hover:bg-surface-secondary rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-center text-text-tertiary">
              <ShoppingCart size={48} className="mx-auto mb-4" />
              <p>Order placement interface coming soon.</p>
              <p className="text-sm mt-2">This will allow you to create purchase orders directly from supplier catalog.</p>
            </div>
            <div className="p-6 border-t border-border-primary">
              <button
                onClick={() => setShowOrderModal(false)}
                className="btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
