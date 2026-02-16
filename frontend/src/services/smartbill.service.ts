import { apiClient } from './api';

// Types
export interface SmartBillWarehouse {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  vatValue: number;
  total: number;
}

export interface SmartBillInvoice {
  id: string;
  orderId?: string;
  smartBillId: string;
  invoiceNumber: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  totalWithVat: number;
  totalWithoutVat: number;
  totalVat: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  items: InvoiceItem[];
  paidAmount?: number;
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmartBillProforma {
  id: string;
  orderId: string;
  smartBillId: string;
  proformaNumber: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  totalWithVat: number;
  totalWithoutVat: number;
  totalVat: number;
  currency: string;
  issueDate: string;
  validUntil?: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceStatus {
  invoiceId: string;
  smartBillId: string;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  paidAmount?: number;
  totalAmount: number;
  paymentDate?: string;
}

export interface PriceSyncResult {
  message: string;
  totalInvoices?: number;
  totalProducts?: number;
  productsUpdated?: number;
  productsCostUpdated?: number;
  errors?: string[];
}

export interface StockSyncResult {
  message: string;
  warehouseId?: string;
  productsSynced?: number;
  errors?: string[];
}

export interface SmartBillCustomerSyncResult {
  message: string;
  totalProcessed: number;
  newLinks: number;
  updatedLinks: number;
  matchedToErp: number;
  conflicts: Array<{
    externalId: string;
    name: string;
    reason: string;
  }>;
}

export interface SmartBillCustomerLink {
  id: number;
  externalId: string;
  externalName: string;
  externalVatCode: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  customerId: number | null;
  erpCompanyName: string | null;
  erpEmail: string | null;
  erpCui: string | null;
  syncStatus: string | null;
  lastSyncAt: string | null;
  conflict: boolean;
  conflictReason: string | null;
}

export interface SmartBillMatchCandidate {
  customerId: number;
  companyName: string;
  cui: string | null;
  email: string | null;
  phone: string | null;
  matchScore: number;
  matchReasons: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface SmartBillMatchResult {
  smartBillCustomerId: string;
  smartBillName: string;
  candidates: SmartBillMatchCandidate[];
  autoMatchSuggestion: SmartBillMatchCandidate | null;
}

export interface SmartBillAutoLinkResult {
  message: string;
  dryRun: boolean;
  linked: number;
  skipped: number;
  details: Array<{ smartBillId: string; customerId: number; score: number }>;
}

class SmartBillService {
  // Invoices
  async createInvoice(data: {
    orderId: string;
    clientId?: string;
    seriesName?: string;
    currency?: string;
    vatIncluded?: boolean;
  }): Promise<SmartBillInvoice> {
    return apiClient.post<SmartBillInvoice>('/smartbill/invoices', data);
  }

  async getInvoice(id: string): Promise<SmartBillInvoice> {
    return apiClient.get<SmartBillInvoice>(`/smartbill/invoices/${id}`);
  }

  async getInvoiceStatus(invoiceId: string): Promise<InvoiceStatus> {
    return apiClient.get<InvoiceStatus>(`/smartbill/invoices/${invoiceId}/status`);
  }

  async markInvoicePaid(
    invoiceId: string,
    data?: {
      paidAmount?: number;
      paymentDate?: string;
    },
  ): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(`/smartbill/invoices/${invoiceId}/paid`, data);
  }

  // Proformas
  async createProforma(data: {
    orderId: string;
    clientId?: string;
    seriesName?: string;
    currency?: string;
    vatIncluded?: boolean;
    validUntil?: string;
  }): Promise<SmartBillProforma> {
    return apiClient.post<SmartBillProforma>('/smartbill/proformas', data);
  }

  async getProforma(id: string): Promise<SmartBillProforma> {
    return apiClient.get<SmartBillProforma>(`/smartbill/proformas/${id}`);
  }

  // Sync Operations
  async syncStock(data?: { warehouseId?: string; syncAll?: boolean }): Promise<StockSyncResult> {
    return apiClient.post<StockSyncResult>('/smartbill/sync-stock', data || {});
  }

  async syncPricesFromInvoices(params?: {
    daysBack?: number;
    strategy?: 'latest' | 'average';
  }): Promise<PriceSyncResult> {
    const queryParams = new URLSearchParams();
    if (params?.daysBack) queryParams.set('daysBack', params.daysBack.toString());
    if (params?.strategy) queryParams.set('strategy', params.strategy);

    const queryString = queryParams.toString();
    return apiClient.post<PriceSyncResult>(
      `/smartbill/sync-prices${queryString ? `?${queryString}` : ''}`,
    );
  }

  async previewPricesFromInvoices(params?: { daysBack?: number }): Promise<PriceSyncResult> {
    const queryParams = new URLSearchParams();
    if (params?.daysBack) queryParams.set('daysBack', params.daysBack.toString());

    const queryString = queryParams.toString();
    return apiClient.get<PriceSyncResult>(
      `/smartbill/preview-prices${queryString ? `?${queryString}` : ''}`,
    );
  }

  // Warehouses
  async getWarehouses(): Promise<SmartBillWarehouse[]> {
    return apiClient.get<SmartBillWarehouse[]>('/smartbill/warehouses');
  }

  // Excel Import (requires FormData)
  async importPricesFromExcel(
    file: File,
    options?: {
      skuColumn?: string;
      priceColumn?: string;
      vatRate?: number;
      priceIncludesVat?: boolean;
      dryRun?: boolean;
    },
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    if (options) {
      if (options.skuColumn) formData.append('skuColumn', options.skuColumn);
      if (options.priceColumn) formData.append('priceColumn', options.priceColumn);
      if (options.vatRate) formData.append('vatRate', options.vatRate.toString());
      if (options.priceIncludesVat !== undefined) {
        formData.append('priceIncludesVat', options.priceIncludesVat.toString());
      }
      if (options.dryRun !== undefined) {
        formData.append('dryRun', options.dryRun.toString());
      }
    }

    const response = await fetch(`/api/v1/smartbill/import-prices`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type, let browser set with boundary
        Authorization: `Bearer ${apiClient.getToken() || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to import prices from Excel');
    }

    return response.json();
  }

  async downloadExcelTemplate(): Promise<Blob> {
    const response = await fetch('/api/v1/smartbill/template', {
      headers: {
        Authorization: `Bearer ${apiClient.getToken() || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    return response.blob();
  }

  async syncCustomers(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<SmartBillCustomerSyncResult> {
    const response: any = await apiClient.post('/smartbill/sync-customers', options || {});
    return (response?.data || response) as SmartBillCustomerSyncResult;
  }

  async getCustomerLinks(params?: {
    status?: 'all' | 'linked' | 'unlinked' | 'conflict' | 'ignored';
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ links: SmartBillCustomerLink[]; meta?: Record<string, unknown> }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.q) queryParams.set('q', params.q);
    if (typeof params?.limit === 'number') queryParams.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') queryParams.set('offset', String(params.offset));

    const query = queryParams.toString();
    const response: any = await apiClient.get(
      `/smartbill/customer-links${query ? `?${query}` : ''}`,
    );
    return {
      links: Array.isArray(response?.data) ? response.data : [],
      meta: response?.meta || undefined,
    };
  }

  async resolveCustomerLink(
    id: number,
    payload: {
      action: 'link' | 'unlink' | 'ignore';
      customerId?: number;
      reason?: string;
    },
  ): Promise<{ message: string; id: number; action: string }> {
    const response: any = await apiClient.patch(`/smartbill/customer-links/${id}/resolve`, payload);
    return (response?.data || response) as { message: string; id: number; action: string };
  }

  // Customer matching and auto-link
  async getCustomerMatchSuggestions(params?: { linkId?: number }): Promise<SmartBillMatchResult[]> {
    const queryParams = new URLSearchParams();
    if (typeof params?.linkId === 'number') queryParams.set('linkId', String(params.linkId));

    const query = queryParams.toString();
    const response: any = await apiClient.get(
      `/smartbill/customer-matches${query ? `?${query}` : ''}`,
    );
    return Array.isArray(response?.data) ? response.data : [];
  }

  async autoLinkCustomers(options?: { dryRun?: boolean }): Promise<SmartBillAutoLinkResult> {
    const response: any = await apiClient.post('/smartbill/customer-auto-link', options || {});
    return (response?.data || response) as SmartBillAutoLinkResult;
  }
}

export const smartbillService = new SmartBillService();
export default smartbillService;
