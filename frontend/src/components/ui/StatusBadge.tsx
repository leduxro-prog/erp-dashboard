import clsx from 'clsx';

export type StatusType =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'draft'
  | 'active'
  | 'inactive'
  | 'quote_pending'
  | 'quote_sent'
  | 'quote_accepted'
  | 'order_confirmed'
  | 'supplier_order_placed'
  | 'awaiting_delivery'
  | 'in_preparation'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'returned'
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'gray';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-accent-warning/15 text-accent-warning',
  },
  processing: {
    label: 'Processing',
    className: 'bg-accent/15 text-accent',
  },
  completed: {
    label: 'Completed',
    className: 'bg-accent-success/15 text-accent-success',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-accent-danger/15 text-accent-danger',
  },
  failed: {
    label: 'Failed',
    className: 'bg-accent-danger/15 text-accent-danger',
  },
  draft: {
    label: 'Draft',
    className: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300',
  },
  active: {
    label: 'Active',
    className: 'bg-accent-success/15 text-accent-success',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300',
  },
  quote_pending: {
    label: 'Quote Pending',
    className: 'bg-accent-warning/15 text-accent-warning',
  },
  quote_sent: {
    label: 'Quote Sent',
    className: 'bg-accent/15 text-accent',
  },
  quote_accepted: {
    label: 'Quote Accepted',
    className: 'bg-accent/15 text-accent',
  },
  order_confirmed: {
    label: 'Order Confirmed',
    className: 'bg-accent/15 text-accent',
  },
  supplier_order_placed: {
    label: 'Supplier Order',
    className: 'bg-accent/15 text-accent',
  },
  awaiting_delivery: {
    label: 'Awaiting Delivery',
    className: 'bg-accent-warning/15 text-accent-warning',
  },
  in_preparation: {
    label: 'In Preparation',
    className: 'bg-accent/15 text-accent',
  },
  ready_to_ship: {
    label: 'Ready to Ship',
    className: 'bg-accent/15 text-accent',
  },
  shipped: {
    label: 'Shipped',
    className: 'bg-accent/15 text-accent',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-accent-success/15 text-accent-success',
  },
  invoiced: {
    label: 'Invoiced',
    className: 'bg-accent/15 text-accent',
  },
  paid: {
    label: 'Paid',
    className: 'bg-accent-success/15 text-accent-success',
  },
  returned: {
    label: 'Returned',
    className: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300',
  },
  green: {
    label: 'Success',
    className: 'bg-accent-success/15 text-accent-success',
  },
  yellow: {
    label: 'Warning',
    className: 'bg-accent-warning/15 text-accent-warning',
  },
  red: {
    label: 'Error',
    className: 'bg-accent-danger/15 text-accent-danger',
  },
  blue: {
    label: 'Info',
    className: 'bg-accent/15 text-accent',
  },
  gray: {
    label: 'Unknown',
    className: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300',
  },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.gray;
  const displayLabel = label || config.label;

  return (
    <span className={clsx('badge', config.className)}>
      {displayLabel}
    </span>
  );
}
