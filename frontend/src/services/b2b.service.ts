import { apiClient } from './api';

interface B2BAccount {
  id: string;
  companyName: string;
  email: string;
  contactPerson: string;
  status: 'active' | 'inactive' | 'pending';
  creditLimit: number;
  usedCredit: number;
}

class B2BService {
  async getAccounts() {
    return apiClient.get<B2BAccount[]>('/b2b/accounts');
  }

  async getAccount(id: string) {
    return apiClient.get<B2BAccount>(`/b2b/accounts/${id}`);
  }

  async createAccount(data: Partial<B2BAccount>) {
    return apiClient.post<B2BAccount>('/b2b/accounts', data);
  }

  async getPortalStatus(accountId: string) {
    return apiClient.get(`/b2b/portal/${accountId}`);
  }
}

export const b2bService = new B2BService();
