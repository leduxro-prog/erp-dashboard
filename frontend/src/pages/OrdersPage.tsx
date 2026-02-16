import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Download,
  Eye,
  Edit2,
  X,
  Package,
  DollarSign,
  User,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderStatus } from '@/types/order';

// Types
interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  quantity_delivered?: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  grand_total: number;
  currency: string;
  payment_terms: string;
  proforma_number?: string;
  invoice_number?: string;
  notes?: string;
  billing_address?: any;
  shipping_address?: any;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

// Status configurations (keys match S3 OrderStatus values from DB)
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  [OrderStatus.QUOTE_PENDING]: { label: 'Quote Pending', color: 'yellow', icon: Clock },
  [OrderStatus.QUOTE_SENT]: { label: 'Quote Sent', color: 'blue', icon: FileText },
  [OrderStatus.QUOTE_ACCEPTED]: { label: 'Quote Accepted', color: 'indigo', icon: CheckCircle },
  [OrderStatus.ORDER_CONFIRMED]: { label: 'Order Confirmed', color: 'blue', icon: CheckCircle },
  [OrderStatus.SUPPLIER_ORDER_PLACED]: {
    label: 'Supplier Order Placed',
    color: 'purple',
    icon: Package,
  },
  [OrderStatus.AWAITING_DELIVERY]: { label: 'Awaiting Delivery', color: 'orange', icon: Clock },
  [OrderStatus.IN_PREPARATION]: { label: 'In Preparation', color: 'indigo', icon: Package },
  [OrderStatus.READY_TO_SHIP]: { label: 'Ready to Ship', color: 'purple', icon: Package },
  [OrderStatus.SHIPPED]: { label: 'Shipped', color: 'cyan', icon: Truck },
  [OrderStatus.DELIVERED]: { label: 'Delivered', color: 'green', icon: CheckCircle },
  [OrderStatus.INVOICED]: { label: 'Invoiced', color: 'blue', icon: FileText },
  [OrderStatus.PAID]: { label: 'Paid', color: 'green', icon: CheckCircle },
  [OrderStatus.CANCELLED]: { label: 'Cancelled', color: 'red', icon: XCircle },
  [OrderStatus.RETURNED]: { label: 'Returned', color: 'gray', icon: AlertCircle },
};

const paymentStatusConfig = {
  UNPAID: { label: 'Unpaid', color: 'red' },
  PARTIAL: { label: 'Partial', color: 'yellow' },
  PAID: { label: 'Paid', color: 'green' },
  REFUNDED: { label: 'Refunded', color: 'gray' },
};

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  // Fetch orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      // Date range filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/v1/orders?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter, dateRange]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchOrders();
      } else {
        setPage(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // View order details
  const viewOrderDetails = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      setSelectedOrder(data.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching order details:', error);
      alert('Failed to load order details');
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus, notes?: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      alert('Order status updated successfully');
      fetchOrders();
      setShowStatusModal(false);
      if (showDetailModal && selectedOrder?.id === orderId) {
        viewOrderDetails(orderId);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  // Cancel order
  const cancelOrder = async (orderId: string, reason: string) => {
    if (!reason) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      alert('Order cancelled successfully');
      fetchOrders();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order');
    }
  };

  // Generate proforma
  const generateProforma = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/proforma`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate proforma');
      }

      const data = await response.json();
      alert(`Proforma generated: ${data.data.proforma_number}`);
      fetchOrders();
      if (showDetailModal && selectedOrder?.id === orderId) {
        viewOrderDetails(orderId);
      }
    } catch (error) {
      console.error('Error generating proforma:', error);
      alert('Failed to generate proforma');
    }
  };

  // Table columns
  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      label: 'Order #',
      sortable: true,
      render: (value) => <span className="font-mono font-semibold text-primary-600">{value}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      sortable: true,
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('ro-RO'),
    },
    {
      key: 'grand_total',
      label: 'Total',
      sortable: true,
      render: (value, row) => (
        <span className="font-semibold">
          {value.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: OrderStatus) => {
        const config = statusConfig[value];
        return <StatusBadge status={value} label={config?.label} />;
      },
    },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (value: PaymentStatus) => {
        const config = paymentStatusConfig[value];
        return <StatusBadge status={config?.color || 'pending'} label={config?.label} />;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => viewOrderDetails(row.id)}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
            title="View details"
          >
            <Eye size={16} className="text-text-secondary" />
          </button>
          <button
            onClick={() => {
              setSelectedOrder(row);
              setShowStatusModal(true);
            }}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
            title="Update status"
          >
            <Edit2 size={16} className="text-text-secondary" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Orders</h1>
          <p className="text-text-secondary mt-1">Manage and track all customer orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              size={18}
            />
            <input
              type="text"
              placeholder="Search orders, customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>

          {/* Export Button */}
          <button className="btn-secondary flex items-center justify-center gap-2">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package size={48} className="text-text-tertiary" />}
          title="No Orders Found"
          description="Start creating orders to manage your business operations."
          actionLabel="Create Order"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <>
          <DataTable columns={columns} data={orders} />

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-text-secondary">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}{' '}
                orders
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

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchOrders();
          }}
        />
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
          onStatusUpdate={(newStatus, notes) =>
            updateOrderStatus(selectedOrder.id, newStatus, notes)
          }
          onCancel={(reason) => cancelOrder(selectedOrder.id, reason)}
          onGenerateProforma={() => generateProforma(selectedOrder.id)}
        />
      )}

      {/* Quick Status Update Modal */}
      {showStatusModal && selectedOrder && (
        <StatusUpdateModal
          order={selectedOrder}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedOrder(null);
          }}
          onUpdate={(newStatus, notes) => updateOrderStatus(selectedOrder.id, newStatus, notes)}
        />
      )}
    </div>
  );
}

// Create Order Modal Component
function CreateOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    currency: 'RON',
    payment_terms: 'NET30',
    shipping_cost: '0',
    discount_amount: '0',
    notes: '',
    items: [] as any[],
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name || !formData.customer_email || formData.items.length === 0) {
      alert('Please fill in all required fields and add at least one item');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          shipping_cost: parseFloat(formData.shipping_cost),
          discount_amount: parseFloat(formData.discount_amount),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      alert('Order created successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-primary rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-primary border-b border-border-primary p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-text-primary">Create New Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-text-primary">Customer Information</h3>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Customer ID *
              </label>
              <input
                type="text"
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                placeholder="Enter customer UUID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Customer Email *
              </label>
              <input
                type="email"
                required
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              />
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-text-primary">Order Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                >
                  <option value="RON">RON</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Payment Terms
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                >
                  <option value="NET30">NET 30</option>
                  <option value="NET60">NET 60</option>
                  <option value="IMMEDIATE">Immediate</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Shipping Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData({ ...formData, shipping_cost: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Discount Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
                rows={3}
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Order Items *</h3>
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    ...formData,
                    items: [
                      ...formData.items,
                      { product_id: '', product_name: '', sku: '', quantity: 1, unit_price: 0 },
                    ],
                  });
                }}
                className="btn-secondary text-sm"
              >
                <Plus size={16} className="mr-1" />
                Add Item
              </button>
            </div>

            {formData.items.length === 0 ? (
              <p className="text-sm text-text-tertiary italic">No items added yet</p>
            ) : (
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-6 gap-2 items-end">
                    <input
                      type="text"
                      placeholder="Product ID"
                      value={item.product_id}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].product_id = e.target.value;
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="col-span-2 px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-sm"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].quantity = parseInt(e.target.value) || 0;
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-sm"
                      required
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].unit_price = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="col-span-2 px-3 py-2 bg-surface-secondary border border-border-primary rounded-lg text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = formData.items.filter((_, i) => i !== index);
                        setFormData({ ...formData, items: newItems });
                      }}
                      className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border-primary">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Order Detail Modal Component
function OrderDetailModal({
  order,
  onClose,
  onStatusUpdate: _onStatusUpdate,
  onCancel,
  onGenerateProforma,
}: {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (status: OrderStatus, notes?: string) => void;
  onCancel: (reason: string) => void;
  onGenerateProforma: () => void;
}) {
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const StatusIcon = statusConfig[order.status]?.icon || Clock;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-primary rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-primary border-b border-border-primary p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Order Details</h2>
            <p className="text-sm text-text-secondary mt-1">Order #{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StatusIcon size={20} className={`text-${statusConfig[order.status]?.color}-500`} />
                <StatusBadge status={order.status} label={statusConfig[order.status]?.label} />
              </div>
              <StatusBadge
                status={paymentStatusConfig[order.payment_status]?.color || 'pending'}
                label={paymentStatusConfig[order.payment_status]?.label}
              />
            </div>

            <div className="flex gap-2">
              {!order.proforma_number && (
                <button onClick={onGenerateProforma} className="btn-secondary text-sm">
                  <FileText size={16} className="mr-1" />
                  Generate Proforma
                </button>
              )}
              {order.status !== OrderStatus.CANCELLED && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                >
                  <XCircle size={16} className="mr-1" />
                  Cancel Order
                </button>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-surface-secondary rounded-lg p-4">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <User size={18} />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-tertiary">Name</p>
                <p className="text-text-primary font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-text-tertiary">Email</p>
                <p className="text-text-primary font-medium">{order.customer_email}</p>
              </div>
            </div>
          </div>

          {/* Order Information */}
          <div className="bg-surface-secondary rounded-lg p-4">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Package size={18} />
              Order Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-text-tertiary">Created</p>
                <p className="text-text-primary font-medium">
                  {new Date(order.created_at).toLocaleDateString('ro-RO')}
                </p>
              </div>
              <div>
                <p className="text-text-tertiary">Payment Terms</p>
                <p className="text-text-primary font-medium">{order.payment_terms}</p>
              </div>
              <div>
                <p className="text-text-tertiary">Currency</p>
                <p className="text-text-primary font-medium">{order.currency}</p>
              </div>
              {order.proforma_number && (
                <div>
                  <p className="text-text-tertiary">Proforma #</p>
                  <p className="text-text-primary font-medium">{order.proforma_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <div className="bg-surface-secondary rounded-lg p-4">
              <h3 className="font-semibold text-text-primary mb-3">Order Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-primary">
                      <th className="text-left py-2">Product</th>
                      <th className="text-left py-2">SKU</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-b border-border-primary/50">
                        <td className="py-2">{item.product_name}</td>
                        <td className="py-2 font-mono text-xs">{item.sku}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{item.unit_price.toFixed(2)}</td>
                        <td className="py-2 text-right font-semibold">
                          {item.line_total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Order Totals */}
          <div className="bg-surface-secondary rounded-lg p-4">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <DollarSign size={18} />
              Order Totals
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-text-primary">
                  {order.subtotal.toFixed(2)} {order.currency}
                </span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>
                    -{order.discount_amount.toFixed(2)} {order.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Tax ({(order.tax_rate * 100).toFixed(0)}%)
                </span>
                <span className="text-text-primary">
                  {order.tax_amount.toFixed(2)} {order.currency}
                </span>
              </div>
              {order.shipping_cost > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Shipping</span>
                  <span className="text-text-primary">
                    {order.shipping_cost.toFixed(2)} {order.currency}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border-primary">
                <span className="font-semibold text-text-primary">Grand Total</span>
                <span className="font-bold text-lg text-primary-600">
                  {order.grand_total.toFixed(2)} {order.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-surface-secondary rounded-lg p-4">
              <h3 className="font-semibold text-text-primary mb-2">Notes</h3>
              <p className="text-sm text-text-secondary">{order.notes}</p>
            </div>
          )}

          {/* Cancel Confirmation */}
          {showCancelConfirm && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-semibold text-red-800 dark:text-red-400 mb-2">Cancel Order</h4>
              <textarea
                placeholder="Enter cancellation reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-surface-secondary border border-border-primary rounded-lg mb-3"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelReason('');
                  }}
                  className="btn-secondary text-sm flex-1"
                >
                  Keep Order
                </button>
                <button
                  onClick={() => {
                    onCancel(cancelReason);
                    setShowCancelConfirm(false);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm flex-1"
                  disabled={!cancelReason}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Status Update Modal Component
function StatusUpdateModal({
  order,
  onClose,
  onUpdate,
}: {
  order: Order;
  onClose: () => void;
  onUpdate: (status: OrderStatus, notes?: string) => void;
}) {
  const [newStatus, setNewStatus] = useState(order.status);
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-primary rounded-xl max-w-md w-full">
        <div className="border-b border-border-primary p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Update Order Status</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Current Status
            </label>
            <StatusBadge status={order.status} label={statusConfig[order.status]?.label} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">New Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-surface-secondary border border-border-primary rounded-lg"
              rows={3}
              placeholder="Add any notes about this status change..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={() => onUpdate(newStatus, notes || undefined)}
              className="btn-primary flex-1"
              disabled={newStatus === order.status}
            >
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
