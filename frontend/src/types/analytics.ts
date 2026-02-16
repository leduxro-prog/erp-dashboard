export interface Widget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'text';
  title: string;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  refreshInterval?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  id: string;
  name: string;
  description?: string;
  type: string;
  format: 'pdf' | 'excel' | 'csv';
  schedule?: 'daily' | 'weekly' | 'monthly';
  recipients?: string[];
  lastGenerated?: string;
  createdBy: string;
  createdAt: string;
}

export interface KPIData {
  id: string;
  name: string;
  value: number;
  target?: number;
  change: number;
  period: string;
  trend?: number[];
}

export interface Forecast {
  id: string;
  metric: string;
  values: Array<{
    date: string;
    actual?: number;
    predicted: number;
    confidence: number;
  }>;
  accuracy?: number;
  generatedAt: string;
}
