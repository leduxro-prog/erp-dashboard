import { apiClient } from './api';

interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  expiryDate: string;
}

class QuotationsService {
  async getQuotations() {
    return apiClient.get<Quotation[]>('/quotations');
  }

  async getQuotation(id: string) {
    return apiClient.get<Quotation>(`/quotations/${id}`);
  }

  async createQuotation(data: Partial<Quotation>) {
    return apiClient.post<Quotation>('/quotations', data);
  }

  async sendQuotation(id: string) {
    return apiClient.put<Quotation>(`/quotations/${id}`, { status: 'sent' });
  }
}

export const quotationsService = new QuotationsService();
