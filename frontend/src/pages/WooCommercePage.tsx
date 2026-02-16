import React, { useState } from 'react';
import { Sync, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

const WooCommercePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('sync-status');

  const syncStatus = {
    connected: true,
    last_sync: '5 minutes ago',
    sync_interval: 'Every 30 minutes',
    products_synced: 156,
    orders_synced: 42,
    sync_errors: 2,
  };

  const productSyncTable = [
    { id: 1, sku: 'LAPTOP-001', woo_id: 'WOO-2145', name: 'Laptop Pro 15"', status: 'Synced', last_sync: '5 min ago' },
    { id: 2, sku: 'MON-027-4K', woo_id: 'WOO-2146', name: 'Monitor 27"', status: 'Synced', last_sync: '5 min ago' },
    { id: 3, sku: 'KEY-MECH-01', woo_id: 'WOO-2147', name: 'Keyboard', status: 'Error', last_sync: '2 hours ago' },
    { id: 4, sku: 'MOUSE-GAM-01', woo_id: 'WOO-2148', name: 'Mouse Gaming', status: 'Synced', last_sync: '5 min ago' },
    { id: 5, sku: 'HEAD-PRO-01', woo_id: 'WOO-2149', name: 'Headphones', status: 'Pending', last_sync: 'In progress' },
  ];

  const ordersImportLog = [
    { id: '#ORD-2024-001', woo_order: 'WOO-12345', customer: 'ABC Corp', date: '2024-01-08', status: 'Imported', amount: 2450 },
    { id: '#ORD-2024-002', woo_order: 'WOO-12346', customer: 'XYZ Ltd', date: '2024-01-08', status: 'Imported', amount: 1250 },
    { id: '#ORD-2024-003', woo_order: 'WOO-12347', customer: 'Tech Inc', date: '2024-01-07', status: 'Error', amount: 3800 },
  ];

  const failedSyncs = [
    { type: 'Product', reference: 'KEYBOARD-001', error: 'Missing required field: price', attempt: 3, last_try: '2024-01-08 14:32' },
    { type: 'Order', reference: 'WOO-12347', error: 'Customer not found in CYPHER', attempt: 2, last_try: '2024-01-07 16:45' },
  ];

  const stockSyncStatus = [
    { product: 'LAPTOP-001', cypher_stock: 12, woo_stock: 12, status: 'Synced', next_sync: '2024-01-08 14:30' },
    { product: 'MON-027-4K', cypher_stock: 25, woo_stock: 24, status: 'Out of Sync', next_sync: 'Now' },
    { product: 'KEY-MECH-01', cypher_stock: 3, woo_stock: 5, status: 'Error', next_sync: 'Retry' },
  ];

  const collectData = [
    { order: '#ORD-2024-045', customer: 'John Doe', items: 3, status: 'Ready for Pickup', date: '2024-01-08' },
    { order: '#ORD-2024-046', customer: 'Jane Smith', items: 2, status: 'Not Ready', date: '2024-01-09' },
    { order: '#ORD-2024-047', customer: 'Bob Wilson', items: 1, status: 'Picked Up', date: '2024-01-07' },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">WooCommerce Integration</h1>
        <button className="btn-primary flex items-center gap-2">
          <RefreshCw size={18} />
          Sync Acum
        </button>
      </div>

      {/* Connection Status */}
      <div className="card mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              {syncStatus.connected ? (
                <CheckCircle className="text-green-500" size={24} />
              ) : (
                <AlertCircle className="text-red-500" size={24} />
              )}
              <h3 className="font-bold text-slate-900 text-lg">
                {syncStatus.connected ? 'Conectat la WooCommerce' : 'Deconectat'}
              </h3>
            </div>
            <p className="text-slate-600 text-sm">Ultima sincronizare: {syncStatus.last_sync}</p>
            <p className="text-slate-600 text-sm">Interval: {syncStatus.sync_interval}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-slate-600 text-sm">Produse Sincronizate</p>
              <p className="text-2xl font-bold text-slate-900">{syncStatus.products_synced}</p>
            </div>
            <div>
              <p className="text-slate-600 text-sm">Comenzi Importate</p>
              <p className="text-2xl font-bold text-slate-900">{syncStatus.orders_synced}</p>
            </div>
            <div>
              <p className="text-slate-600 text-sm">Erori</p>
              <p className="text-2xl font-bold text-red-600">{syncStatus.sync_errors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'sync-status', label: 'Status' },
            { id: 'products', label: 'Produse' },
            { id: 'orders', label: 'Comenzi' },
            { id: 'failed', label: 'Erori' },
            { id: 'stock', label: 'Stoc' },
            { id: 'collect', label: 'Click & Collect' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>WooCommerce ID</th>
                  <th>Produs</th>
                  <th>Status</th>
                  <th>Sincronizare</th>
                </tr>
              </thead>
              <tbody>
                {productSyncTable.map(prod => (
                  <tr key={prod.id}>
                    <td className="font-mono text-sm font-bold">{prod.sku}</td>
                    <td className="text-sm text-slate-600">{prod.woo_id}</td>
                    <td>{prod.name}</td>
                    <td>
                      <span className={`${prod.status === 'Synced' ? 'badge-success' : prod.status === 'Error' ? 'badge-danger' : 'badge-warning'}`}>
                        {prod.status}
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{prod.last_sync}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Comanda</th>
                  <th>WooCommerce</th>
                  <th>Client</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Suma</th>
                </tr>
              </thead>
              <tbody>
                {ordersImportLog.map(ord => (
                  <tr key={ord.id}>
                    <td className="font-bold text-slate-900">{ord.id}</td>
                    <td className="text-sm text-slate-600">{ord.woo_order}</td>
                    <td>{ord.customer}</td>
                    <td className="text-sm text-slate-600">{ord.date}</td>
                    <td><span className={`${ord.status === 'Imported' ? 'badge-success' : 'badge-danger'}`}>{ord.status}</span></td>
                    <td className="font-bold">{ord.amount.toLocaleString()} RON</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Failed Tab */}
      {activeTab === 'failed' && (
        <div className="space-y-4">
          {failedSyncs.map((sync, idx) => (
            <div key={idx} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-slate-900">{sync.type}: {sync.reference}</p>
                  <p className="text-sm text-red-600 mt-1">{sync.error}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600">Incercare {sync.attempt}</p>
                </div>
              </div>
              <button className="btn-secondary text-sm w-full">Reincercheaza</button>
            </div>
          ))}
        </div>
      )}

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produs</th>
                  <th>Stoc CYPHER</th>
                  <th>Stoc WooCommerce</th>
                  <th>Status</th>
                  <th>Urmatoare</th>
                </tr>
              </thead>
              <tbody>
                {stockSyncStatus.map((stock, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-slate-900">{stock.product}</td>
                    <td className="font-bold">{stock.cypher_stock}</td>
                    <td className={stock.cypher_stock !== stock.woo_stock ? 'text-red-600 font-bold' : 'font-bold'}>
                      {stock.woo_stock}
                    </td>
                    <td>
                      <span className={`${stock.status === 'Synced' ? 'badge-success' : stock.status === 'Out of Sync' ? 'badge-warning' : 'badge-danger'}`}>
                        {stock.status}
                      </span>
                    </td>
                    <td className="text-sm">{stock.next_sync}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collect Tab */}
      {activeTab === 'collect' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Comanda</th>
                  <th>Client</th>
                  <th>Articole</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {collectData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-slate-900">{item.order}</td>
                    <td>{item.customer}</td>
                    <td className="text-sm">{item.items} articole</td>
                    <td>
                      <span className={`${item.status === 'Ready for Pickup' ? 'badge-success' : item.status === 'Picked Up' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export { WooCommercePage };
export default WooCommercePage;
