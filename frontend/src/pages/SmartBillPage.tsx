import { useState, useEffect } from 'react';
import {
  Receipt,
  FileText,
  RefreshCw,
  Download,
  Upload,
  Search,
  Plus,
  CheckCircle2,
  Package,
  Warehouse,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  Users,
} from 'lucide-react';
import {
  smartbillService,
  type SmartBillWarehouse,
  type SmartBillInvoice,
  type SmartBillCustomerSyncResult,
  type SmartBillCustomerLink,
} from '@/services/smartbill.service';
import { apiClient } from '@/services/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';

type ViewMode =
  | 'dashboard'
  | 'invoices'
  | 'proformas'
  | 'sync'
  | 'prices'
  | 'warehouses'
  | 'customers';

export function SmartBillPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [warehouses, setWarehouses] = useState<SmartBillWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const warehousesData = await smartbillService.getWarehouses();
      setWarehouses(warehousesData);
    } catch (error) {
      console.error('Error loading initial SmartBill data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">SmartBill Integration</h1>
          <p className="text-text-secondary mt-1">
            Manage invoices, proformas, and inventory synchronization
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Connected to SmartBill API
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
          onClick={() => setViewMode('invoices')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'invoices'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setViewMode('proformas')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'proformas'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Proformas
        </button>
        <button
          onClick={() => setViewMode('sync')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'sync'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Stock Sync
        </button>
        <button
          onClick={() => setViewMode('prices')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'prices'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Price Management
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
        <button
          onClick={() => setViewMode('customers')}
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            viewMode === 'customers'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Customer Sync
        </button>
      </div>

      {/* View Content */}
      <div className="min-h-[400px]">
        {loading && viewMode === 'dashboard' ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {viewMode === 'dashboard' && (
              <SmartBillDashboard
                warehouses={warehouses}
                onViewInvoices={() => setViewMode('invoices')}
                onViewSync={() => setViewMode('sync')}
              />
            )}
            {viewMode === 'invoices' && <InvoicesView />}
            {viewMode === 'proformas' && <ProformasView />}
            {viewMode === 'sync' && <StockSyncView warehouses={warehouses} />}
            {viewMode === 'prices' && <PriceManagementView />}
            {viewMode === 'warehouses' && <WarehousesView warehouses={warehouses} />}
            {viewMode === 'customers' && <CustomerSyncView />}
          </>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function SmartBillDashboard({
  warehouses,
  onViewInvoices,
  onViewSync,
}: {
  warehouses: SmartBillWarehouse[];
  onViewInvoices: () => void;
  onViewSync: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Active Warehouses</p>
              <p className="text-2xl font-bold text-text-primary">{warehouses.length}</p>
            </div>
            <Warehouse size={24} className="text-blue-500" />
          </div>
        </div>

        <div
          className="bg-surface-primary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-primary-500 transition-colors"
          onClick={onViewInvoices}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Monthly Invoices</p>
              <p className="text-2xl font-bold text-text-primary">124</p>
            </div>
            <Receipt size={24} className="text-green-500" />
          </div>
        </div>

        <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Total Billed</p>
              <p className="text-2xl font-bold text-text-primary">45,230 RON</p>
            </div>
            <DollarSign size={24} className="text-primary-500" />
          </div>
        </div>

        <div
          className="bg-surface-primary border border-border-primary rounded-xl p-4 cursor-pointer hover:border-primary-500 transition-colors"
          onClick={onViewSync}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-tertiary">Last Sync</p>
              <p className="text-lg font-bold text-text-primary">15 min ago</p>
            </div>
            <RefreshCw size={24} className="text-yellow-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices Stub */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Recent Invoices</h3>
            <button onClick={onViewInvoices} className="text-sm text-primary-600 hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-4">
            {[
              {
                id: '1',
                no: 'FACT-001',
                client: 'Ledux Impex',
                total: '1,200 RON',
                status: 'paid',
              },
              {
                id: '2',
                no: 'FACT-002',
                client: 'Green Solutions',
                total: '850 RON',
                status: 'issued',
              },
              {
                id: '3',
                no: 'FACT-003',
                client: 'Tech Parts SRL',
                total: '2,450 RON',
                status: 'issued',
              },
            ].map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg"
              >
                <div>
                  <p className="font-medium text-text-primary">{inv.no}</p>
                  <p className="text-xs text-text-tertiary">{inv.client}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-text-primary">{inv.total}</p>
                  <StatusBadge
                    status={inv.status === 'paid' ? 'green' : 'blue'}
                    label={inv.status}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sync Status stub */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Sync Health</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                <Package size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">Product Sync</span>
                  <span className="text-sm text-green-600">100% Synced</span>
                </div>
                <div className="w-full bg-surface-secondary rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                <DollarSign size={24} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">Price Updates</span>
                  <span className="text-sm text-yellow-600">Pending</span>
                </div>
                <div className="w-full bg-surface-secondary rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">Automatic Sync Active</p>
                  <p className="mt-1">
                    SmartBill stock is synchronized every 15 minutes. All 8,807 products are
                    currently up to date.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoicesView() {
  const [invoices, setInvoices] = useState<SmartBillInvoice[]>([]);

  // In a real app, we would fetch from API
  useEffect(() => {
    // Stub data
    setInvoices([]);
  }, []);

  const columns: Column<SmartBillInvoice>[] = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      render: (val) => <span className="font-mono font-medium text-primary-600">{val}</span>,
    },
    {
      key: 'issueDate',
      label: 'Date',
      render: (val) => new Date(val).toLocaleDateString('ro-RO'),
    },
    {
      key: 'totalWithVat',
      label: 'Total',
      render: (val, row) => (
        <span className="font-semibold">
          {val.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const config: any = {
          paid: { color: 'green', label: 'Paid' },
          issued: { color: 'blue', label: 'Issued' },
          draft: { color: 'gray', label: 'Draft' },
          cancelled: { color: 'red', label: 'Cancelled' },
        };
        const c = config[val] || { color: 'gray', label: val };
        return <StatusBadge status={c.color} label={c.label} />;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: () => (
        <div className="flex gap-2">
          <button className="p-2 hover:bg-surface-secondary rounded-lg">
            <ExternalLink size={16} />
          </button>
          <button className="p-2 hover:bg-surface-secondary rounded-lg">
            <Download size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            size={18}
          />
          <input
            type="text"
            placeholder="Search invoices..."
            className="w-full pl-10 pr-4 py-2 bg-surface-primary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Invoice
        </button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt size={48} className="text-text-tertiary" />}
          title="No Invoices Found"
          description="Sync invoices from SmartBill or create a new one from an order."
        />
      ) : (
        <DataTable columns={columns} data={invoices} />
      )}
    </div>
  );
}

function ProformasView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            size={18}
          />
          <input
            type="text"
            placeholder="Search proformas..."
            className="w-full pl-10 pr-4 py-2 bg-surface-primary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Proforma
        </button>
      </div>

      <EmptyState
        icon={<FileText size={48} className="text-text-tertiary" />}
        title="No Proformas Found"
        description="Create proformas for your quotes or orders."
      />
    </div>
  );
}

function StockSyncView({ warehouses }: { warehouses: SmartBillWarehouse[] }) {
  const [syncing, setSyncing] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setResult(null);
      const data = await smartbillService.syncStock({
        warehouseId: selectedWarehouse === 'all' ? undefined : selectedWarehouse,
        syncAll: selectedWarehouse === 'all',
      });
      setResult(data);
      alert('Stock sync triggered successfully');
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <RefreshCw size={32} className={`text-primary-600 ${syncing ? 'animate-spin' : ''}`} />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary">Stock Synchronization</h2>
        <p className="text-text-secondary mt-2">
          Pull current stock levels from SmartBill warehouses into Cypher ERP.
        </p>
      </div>

      <div className="bg-surface-primary border border-border-primary rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-3">
            Select Warehouse
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedWarehouse('all')}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedWarehouse === 'all'
                  ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500'
                  : 'border-border-primary bg-surface-secondary hover:border-border-secondary'
              }`}
            >
              <p className="font-semibold text-text-primary">All Warehouses</p>
              <p className="text-xs text-text-tertiary mt-1">
                Full synchronization of all locations
              </p>
            </button>
            {warehouses.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWarehouse(w.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedWarehouse === w.id
                    ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500'
                    : 'border-border-primary bg-surface-secondary hover:border-border-secondary'
                }`}
              >
                <p className="font-semibold text-text-primary">{w.name}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {w.isDefault ? 'Default Warehouse' : 'Storage Location'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-lg"
          >
            {syncing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Synchronizing...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Start Stock Sync
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="mt-6 p-4 bg-surface-secondary rounded-lg border border-border-primary animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 size={18} />
              <p className="font-semibold">{result.message}</p>
            </div>
            {result.productsSynced && (
              <p className="text-sm text-text-secondary">
                Products processed: <span className="font-bold">{result.productsSynced}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h3 className="text-blue-800 font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle size={18} />
          Important Note
        </h3>
        <p className="text-sm text-blue-700 leading-relaxed">
          The synchronization process updates Cypher ERP's internal stock levels based on SmartBill
          data. If products in ERP do not exist in SmartBill (matching by SKU), they will be
          ignored. Sync history can be viewed in the System Logs.
        </p>
      </div>
    </div>
  );
}

function PriceManagementView() {
  const [activeTab, setActiveTab] = useState<'sync' | 'import'>('sync');
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleSyncFromInvoices = async () => {
    try {
      setSyncing(true);
      const result = await smartbillService.syncPricesFromInvoices({ daysBack: 30 });
      alert(result.message);
    } catch (error) {
      console.error('Price sync error:', error);
      alert('Failed to sync prices');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImportExcel = async () => {
    if (!file) return;
    try {
      setUploading(true);
      const result = await smartbillService.importPricesFromExcel(file);
      alert('Import successful: ' + (result.message || 'Prices updated'));
      setFile(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import from Excel');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await smartbillService.downloadExcelTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smartbill_price_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download template error:', error);
      alert('Failed to download template');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center gap-2 mb-8 bg-surface-secondary p-1 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setActiveTab('sync')}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'sync'
              ? 'bg-surface-primary shadow-sm text-primary-600'
              : 'text-text-secondary'
          }`}
        >
          Sync from Invoices
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'import'
              ? 'bg-surface-primary shadow-sm text-primary-600'
              : 'text-text-secondary'
          }`}
        >
          Import Excel
        </button>
      </div>

      {activeTab === 'sync' ? (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto">
            <DollarSign size={32} className="text-blue-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary">
              Sync Prices from SmartBill Invoices
            </h3>
            <p className="text-text-secondary max-w-md mx-auto">
              Automatically update internal product acquisition prices by analyzing recent supplier
              invoices from SmartBill.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-lg mx-auto bg-surface-secondary p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 mt-0.5" />
              <p className="text-sm text-text-primary">Uses latest invoice price</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 mt-0.5" />
              <p className="text-sm text-text-primary">Matches by Product SKU</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 mt-0.5" />
              <p className="text-sm text-text-primary">Updates cost & markup</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 mt-0.5" />
              <p className="text-sm text-text-primary">Calculates weighted avg</p>
            </div>
          </div>
          <button
            onClick={handleSyncFromInvoices}
            disabled={syncing}
            className="btn-primary px-8 py-3 flex items-center gap-2 mx-auto"
          >
            {syncing ? <RefreshCw size={20} className="animate-spin" /> : <RefreshCw size={20} />}
            Start Price Sync (Last 30 Days)
          </button>
        </div>
      ) : (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
            <Upload size={32} className="text-purple-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-text-primary">Import Prices from Excel</h3>
            <p className="text-text-secondary max-w-md mx-auto">
              Bulk update product prices by uploading an Excel file exported from SmartBill or your
              own list.
            </p>
          </div>

          <div className="max-w-md mx-auto p-6 border-2 border-dashed border-border-primary rounded-xl hover:border-primary-500 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="excel-upload"
            />
            <label htmlFor="excel-upload" className="cursor-pointer space-y-2 block">
              <div className="text-primary-600 font-medium">Click to select file</div>
              <p className="text-xs text-text-tertiary">Support for .xlsx and .xls files</p>
              {file && (
                <div className="mt-4 p-2 bg-primary-50 text-primary-700 rounded text-sm flex items-center justify-center gap-2">
                  <FileText size={16} />
                  {file.name}
                </div>
              )}
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={downloadTemplate}
              className="btn-secondary flex items-center gap-2 w-full sm:w-auto"
            >
              <Download size={18} />
              Download Template
            </button>
            <button
              onClick={handleImportExcel}
              disabled={!file || uploading}
              className="btn-primary flex items-center gap-2 w-full sm:w-auto"
            >
              {uploading ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
              Upload & Process
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerSyncView() {
  const [syncing, setSyncing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState<SmartBillCustomerSyncResult | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'linked' | 'unlinked' | 'conflict' | 'ignored'
  >('conflict');
  const [searchTerm, setSearchTerm] = useState('');
  const [links, setLinks] = useState<SmartBillCustomerLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  const [selectedLink, setSelectedLink] = useState<SmartBillCustomerLink | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerCandidates, setCustomerCandidates] = useState<
    Array<{ sourceId: number; displayName: string; email: string; cui: string | null }>
  >([]);
  const [resolvingAction, setResolvingAction] = useState(false);

  const loadLinks = async (overrideStatus?: string, overrideSearch?: string) => {
    try {
      setLinksLoading(true);
      const response = await smartbillService.getCustomerLinks({
        status: (overrideStatus || statusFilter) as any,
        q: (overrideSearch ?? searchTerm).trim() || undefined,
        limit: 100,
      });
      setLinks(response.links || []);
    } catch (error) {
      console.error('Failed to load SmartBill customer links:', error);
      alert('Nu s-au putut incarca link-urile SmartBill.');
    } finally {
      setLinksLoading(false);
    }
  };

  useEffect(() => {
    loadLinks(statusFilter, searchTerm);
  }, [statusFilter]);

  const handleSyncCustomers = async () => {
    try {
      setSyncing(true);
      const data = await smartbillService.syncCustomers({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setResult(data);
      await loadLinks();
    } catch (error) {
      console.error('SmartBill customer sync failed:', error);
      alert('Nu s-a putut sincroniza lista de clienti SmartBill.');
    } finally {
      setSyncing(false);
    }
  };

  const resolveLink = async (
    linkId: number,
    action: 'link' | 'unlink' | 'ignore',
    customerId?: number,
  ) => {
    try {
      setResolvingAction(true);
      await smartbillService.resolveCustomerLink(linkId, {
        action,
        customerId,
        reason: 'Manual resolution from SmartBill customer sync UI',
      });
      await loadLinks();
      if (selectedLink?.id === linkId && action !== 'link') {
        setSelectedLink(null);
      }
      if (selectedLink?.id === linkId && action === 'link') {
        setSelectedLink(null);
        setCustomerCandidates([]);
        setCustomerSearch('');
      }
    } catch (error) {
      console.error('Failed to resolve customer link:', error);
      alert('Nu s-a putut actualiza legatura clientului.');
    } finally {
      setResolvingAction(false);
    }
  };

  const searchErpCustomers = async () => {
    const term = customerSearch.trim();
    if (term.length < 2) {
      alert('Introdu minim 2 caractere pentru cautare.');
      return;
    }

    try {
      setSearchingCustomers(true);
      const response: any = await apiClient.get(
        `/customers/search?q=${encodeURIComponent(term)}&sources=erp&limit=20`,
      );
      const rows = Array.isArray(response?.data) ? response.data : [];
      const mapped = Array.isArray(rows)
        ? rows
            .map((row: any) => {
              const sourceId = Number(row.sourceId ?? String(row.id || '').replace('erp_', ''));
              if (!Number.isFinite(sourceId)) return null;
              return {
                sourceId,
                displayName: row.displayName || row.companyName || row.display_name || 'Customer',
                email: row.email || '',
                cui: row.cui || null,
              };
            })
            .filter(Boolean)
        : [];
      setCustomerCandidates(
        mapped as Array<{
          sourceId: number;
          displayName: string;
          email: string;
          cui: string | null;
        }>,
      );
    } catch (error) {
      console.error('Failed to search ERP customers:', error);
      alert('Nu s-au putut cauta clientii ERP.');
    } finally {
      setSearchingCustomers(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="bg-surface-primary border border-border-primary rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">SmartBill Customer Sync</h3>
            <p className="text-sm text-text-secondary">
              Sincronizeaza clientii din facturile SmartBill si rezolva conflictele de mapare catre
              ERP.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
          </div>
        </div>

        <button
          onClick={handleSyncCustomers}
          disabled={syncing}
          className="btn-primary flex items-center gap-2"
        >
          {syncing ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Sincronizare in progres...' : 'Start Customer Sync'}
        </button>
      </div>

      {result && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6 space-y-4">
          <h4 className="text-md font-semibold text-text-primary">Rezultat sincronizare</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-surface-secondary border border-border-primary">
              <p className="text-xs text-text-tertiary">Procesate</p>
              <p className="text-xl font-bold text-text-primary">{result.totalProcessed}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs text-green-700">Link-uri noi</p>
              <p className="text-xl font-bold text-green-700">{result.newLinks}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700">Actualizate</p>
              <p className="text-xl font-bold text-blue-700">{result.updatedLinks}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
              <p className="text-xs text-purple-700">Mapate ERP</p>
              <p className="text-xl font-bold text-purple-700">{result.matchedToErp}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-700">Conflicte</p>
              <p className="text-xl font-bold text-orange-700">{result.conflicts.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-primary border border-border-primary rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'conflict', label: 'Conflicte' },
              { value: 'unlinked', label: 'Nemapate' },
              { value: 'linked', label: 'Mapate' },
              { value: 'ignored', label: 'Ignorate' },
              { value: 'all', label: 'Toate' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setStatusFilter(item.value as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  statusFilter === item.value
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-surface-secondary border-border-primary text-text-secondary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cauta dupa nume/CUI/email"
              className="w-full md:w-72 px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
            <button onClick={() => loadLinks()} className="btn-secondary px-3 py-2">
              Cauta
            </button>
          </div>
        </div>

        {linksLoading ? (
          <div className="py-10 text-center text-text-secondary">Se incarca link-urile...</div>
        ) : links.length === 0 ? (
          <div className="py-10 text-center text-text-tertiary">
            Nu exista inregistrari pentru filtrul ales.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border-primary rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">Client SmartBill</th>
                  <th className="px-4 py-3 text-left">Client ERP mapat</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-t border-border-primary">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{link.externalName}</p>
                      <p className="text-xs text-text-tertiary">
                        {link.externalVatCode || '-'} | {link.externalEmail || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {link.customerId ? (
                        <>
                          <p className="font-medium text-text-primary">
                            {link.erpCompanyName || '-'}
                          </p>
                          <p className="text-xs text-text-tertiary">{link.erpEmail || '-'}</p>
                        </>
                      ) : (
                        <span className="text-xs text-text-tertiary italic">Nemapat</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {link.conflict ? (
                        <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                          Conflict
                        </span>
                      ) : link.syncStatus === 'ignored' ? (
                        <span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold">
                          Ignorat
                        </span>
                      ) : link.customerId ? (
                        <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                          Mapat
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          Nemapat
                        </span>
                      )}
                      {link.conflictReason && (
                        <p className="text-[11px] text-red-600 mt-1">{link.conflictReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedLink(link);
                            setCustomerSearch(link.externalName || '');
                            setCustomerCandidates([]);
                          }}
                          className="px-2.5 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Mapare ERP
                        </button>
                        {link.customerId && (
                          <button
                            disabled={resolvingAction}
                            onClick={() => resolveLink(link.id, 'unlink')}
                            className="px-2.5 py-1.5 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                          >
                            Unlink
                          </button>
                        )}
                        <button
                          disabled={resolvingAction}
                          onClick={() => resolveLink(link.id, 'ignore')}
                          className="px-2.5 py-1.5 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                        >
                          Ignore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLink && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-md font-semibold text-text-primary">Mapare manuala client ERP</h4>
              <p className="text-sm text-text-secondary mt-1">
                SmartBill:{' '}
                <span className="font-medium text-text-primary">{selectedLink.externalName}</span>
              </p>
            </div>
            <button
              onClick={() => setSelectedLink(null)}
              className="text-text-tertiary hover:text-text-primary"
            >
              Inchide
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Cauta client ERP dupa nume/CUI/email"
              className="flex-1 px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            />
            <button
              onClick={searchErpCustomers}
              className="btn-secondary px-3 py-2"
              disabled={searchingCustomers}
            >
              {searchingCustomers ? 'Se cauta...' : 'Cauta'}
            </button>
          </div>

          <div className="max-h-64 overflow-auto border border-border-primary rounded-lg divide-y divide-border-primary">
            {customerCandidates.length === 0 ? (
              <div className="p-4 text-sm text-text-tertiary">Niciun rezultat.</div>
            ) : (
              customerCandidates.map((candidate) => (
                <div
                  key={candidate.sourceId}
                  className="p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{candidate.displayName}</p>
                    <p className="text-xs text-text-tertiary">
                      {candidate.cui || '-'} | {candidate.email || '-'}
                    </p>
                  </div>
                  <button
                    disabled={resolvingAction}
                    onClick={() => resolveLink(selectedLink.id, 'link', candidate.sourceId)}
                    className="px-2.5 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    Leaga
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WarehousesView({ warehouses }: { warehouses: SmartBillWarehouse[] }) {
  const columns: Column<SmartBillWarehouse>[] = [
    {
      key: 'name',
      label: 'Warehouse Name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Warehouse size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">{val}</p>
            {row.isDefault && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => val || '-',
    },
    {
      key: 'id',
      label: 'SmartBill Code',
      render: (val) => (
        <code className="text-xs bg-surface-secondary px-2 py-1 rounded">{val}</code>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-text-primary">SmartBill Warehouses</h3>
        <button
          onClick={() => {
            /* refresh */
          }}
          className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
        >
          <RefreshCw size={18} className="text-text-secondary" />
        </button>
      </div>

      <DataTable columns={columns} data={warehouses} />
    </div>
  );
}
