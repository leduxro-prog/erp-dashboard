import { Clock, Loader2, Truck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  pending: {
    label: 'În așteptare',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    icon: Clock,
  },
  processing: {
    label: 'În procesare',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: Loader2,
  },
  shipped: {
    label: 'Expediată',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: Truck,
  },
  delivered: {
    label: 'Livrată',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Anulată',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: XCircle,
  },
  on_hold: {
    label: 'În așteptare',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    icon: AlertTriangle,
  },
};

export const INVOICE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Ciornă', bg: 'bg-gray-100', text: 'text-gray-800' },
  issued: { label: 'Emisă', bg: 'bg-blue-100', text: 'text-blue-800' },
  sent: { label: 'Trimisă', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  paid: { label: 'Plătită', bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { label: 'Anulată', bg: 'bg-red-100', text: 'text-red-800' },
};

export const PAYMENT_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  unpaid: { label: 'Neplătită', bg: 'bg-red-100', text: 'text-red-800' },
  partial: { label: 'Parțial', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  paid: { label: 'Plătită', bg: 'bg-green-100', text: 'text-green-800' },
};

export const VAT_RATE = 0.21;
