export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  WALLET = 'wallet',
  MIXED = 'mixed',
}

export interface Payment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  timestamp: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  payments: Payment[];
  cashierId: string;
  terminalId?: string;
  notes?: string;
  createdAt: string;
  completedAt: string;
}

export interface Receipt {
  id: string;
  saleId: string;
  receiptNumber: string;
  total: number;
  printedAt: string;
}

export interface CashDrawer {
  id: string;
  terminalId: string;
  cashierId: string;
  openingBalance: number;
  closingBalance?: number;
  totalIn: number;
  totalOut: number;
  variance?: number;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
}

export interface DailyReport {
  id: string;
  date: string;
  totalSales: number;
  totalTransactions: number;
  paymentBreakdown: Record<PaymentMethod, number>;
  averageTransactionValue: number;
  topProducts: Array<{
    productId: string;
    quantity: number;
    revenue: number;
  }>;
  generatedAt: string;
}
