import { apiClient } from './api';
import { Dashboard, Report, KPIData, Forecast } from '../types/analytics';

class AnalyticsService {
  async getDashboards(): Promise<Dashboard[]> {
    return apiClient.get<Dashboard[]>('/analytics/dashboards');
  }

  async getDashboardById(id: string): Promise<Dashboard> {
    return apiClient.get<Dashboard>(`/analytics/dashboards/${id}`);
  }

  async createDashboard(data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    return apiClient.post<Dashboard>('/analytics/dashboards', data);
  }

  async updateDashboard(id: string, data: Partial<Dashboard>): Promise<Dashboard> {
    return apiClient.patch<Dashboard>(`/analytics/dashboards/${id}`, data);
  }

  async deleteDashboard(id: string): Promise<void> {
    await apiClient.delete(`/analytics/dashboards/${id}`);
  }

  async getReports(): Promise<Report[]> {
    return apiClient.get<Report[]>('/analytics/reports');
  }

  async getReportById(id: string): Promise<Report> {
    return apiClient.get<Report>(`/analytics/reports/${id}`);
  }

  async createReport(data: Omit<Report, 'id' | 'createdAt'>): Promise<Report> {
    return apiClient.post<Report>('/analytics/reports', data);
  }

  async updateReport(id: string, data: Partial<Report>): Promise<Report> {
    return apiClient.patch<Report>(`/analytics/reports/${id}`, data);
  }

  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/analytics/reports/${id}`);
  }

  async generateReport(reportId: string): Promise<Blob> {
    const response = await fetch(`/api/v1/analytics/reports/${reportId}/generate`, {
      headers: { Authorization: `Bearer ${apiClient.getToken()}` },
    });
    return response.blob();
  }

  async getKPIs(dashboardId?: string): Promise<KPIData[]> {
    const url = dashboardId
      ? `/analytics/kpis?dashboardId=${dashboardId}`
      : '/analytics/kpis';
    return apiClient.get<KPIData[]>(url);
  }

  async getKPIById(id: string): Promise<KPIData> {
    return apiClient.get<KPIData>(`/analytics/kpis/${id}`);
  }

  async getForecasts(metric?: string): Promise<Forecast[]> {
    const url = metric ? `/analytics/forecasts?metric=${metric}` : '/analytics/forecasts';
    return apiClient.get<Forecast[]>(url);
  }

  async generateForecast(metric: string, periods: number): Promise<Forecast> {
    return apiClient.post<Forecast>('/analytics/forecasts', { metric, periods });
  }

  async getSalesAnalytics(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<any> {
    const queryString = new URLSearchParams(params as any);
    return apiClient.get<any>(`/analytics/sales?${queryString.toString()}`);
  }

  async getInventoryAnalytics(): Promise<any> {
    return apiClient.get<any>('/analytics/inventory');
  }

  async getCustomerAnalytics(): Promise<any> {
    return apiClient.get<any>('/analytics/customers');
  }
}

export const analyticsService = new AnalyticsService();

export default analyticsService;
