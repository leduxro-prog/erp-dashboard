import { apiClient } from './api';
import { Sale, CashDrawer, Receipt, DailyReport, CartItem, PaymentMethod } from '../types/pos';
import { PaginatedResponse, PaginationParams } from '../types/common';

class POSService {
  async createSale(data: {
    items: CartItem[];
    subtotal: number;
    tax: number;
    discount?: number;
    total: number;
    payments: Array<{
      method: PaymentMethod;
      amount: number;
      reference?: string;
    }>;
    terminalId?: string;
    notes?: string;
  }): Promise<Sale> {
    return apiClient.post<Sale>('/pos/sales', data);
  }

  async getSale(id: string): Promise<Sale> {
    return apiClient.get<Sale>(`/pos/sales/${id}`);
  }

  async getSales(params?: PaginationParams): Promise<PaginatedResponse<Sale>> {
    const queryString = new URLSearchParams();
    if (params) {
      queryString.set('page', params.page.toString());
      queryString.set('limit', params.limit.toString());
    }
    return apiClient.get<PaginatedResponse<Sale>>(
      `/pos/sales?${queryString.toString()}`
    );
  }

  async getSalesByDateRange(startDate: string, endDate: string): Promise<Sale[]> {
    return apiClient.get<Sale[]>(
      `/pos/sales?startDate=${startDate}&endDate=${endDate}`
    );
  }

  async returnSale(saleId: string, items: Array<{ id: string; quantity: number }>): Promise<Sale> {
    return apiClient.post<Sale>(`/pos/sales/${saleId}/return`, { items });
  }

  async openCashDrawer(data: {
    terminalId: string;
    openingBalance: number;
  }): Promise<CashDrawer> {
    return apiClient.post<CashDrawer>('/pos/cash-drawer/open', data);
  }

  async closeCashDrawer(drawerId: string, closingBalance: number): Promise<CashDrawer> {
    return apiClient.post<CashDrawer>(`/pos/cash-drawer/${drawerId}/close`, {
      closingBalance,
    });
  }

  async getCashDrawer(id: string): Promise<CashDrawer> {
    return apiClient.get<CashDrawer>(`/pos/cash-drawer/${id}`);
  }

  async getCurrentCashDrawer(terminalId: string): Promise<CashDrawer | null> {
    return apiClient.get<CashDrawer | null>(`/pos/cash-drawer/current/${terminalId}`);
  }

  async getReceipt(saleId: string): Promise<Receipt> {
    return apiClient.get<Receipt>(`/pos/receipts/${saleId}`);
  }

  async printReceipt(saleId: string): Promise<Blob> {
    const response = await fetch(`/api/v1/pos/receipts/${saleId}/print`, {
      headers: { Authorization: `Bearer ${apiClient.getToken()}` },
    });
    return response.blob();
  }

  async getDailyReport(date: string): Promise<DailyReport> {
    return apiClient.get<DailyReport>(`/pos/reports/daily/${date}`);
  }

  async generateDailyReport(date: string): Promise<DailyReport> {
    return apiClient.post<DailyReport>(`/pos/reports/daily/${date}`, {});
  }

  async getTerminalStats(terminalId: string, date: string): Promise<any> {
    return apiClient.get<any>(`/pos/terminals/${terminalId}/stats?date=${date}`);
  }
}

export const posService = new POSService();

export default posService;
