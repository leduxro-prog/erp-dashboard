/**
 * IAttributionEventRepository
 * Port interface for attribution event persistence operations
 */
import { AttributionEvent } from '../entities/AttributionEvent';

export interface AttributionFilter {
  campaignId?: string;
  customerId?: string;
  channel?: string;
  isConversion?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface AttributionSummary {
  channel: string;
  touchpoints: number;
  conversions: number;
  revenue: number;
  cost: number;
  roas: number;
}

export interface FunnelStep {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface IAttributionEventRepository {
  save(event: AttributionEvent): Promise<AttributionEvent>;
  bulkSave(events: AttributionEvent[]): Promise<AttributionEvent[]>;
  findById(id: string): Promise<AttributionEvent | null>;
  findByFilter(
    filter: AttributionFilter,
    pagination: { page: number; limit: number },
  ): Promise<{ items: AttributionEvent[]; total: number; page: number; pages: number }>;
  getAttributionSummary(filter: {
    startDate: Date;
    endDate: Date;
    campaignId?: string;
  }): Promise<AttributionSummary[]>;
  getFunnelData(campaignId: string, startDate: Date, endDate: Date): Promise<FunnelStep[]>;
  getRevenueByChannel(
    startDate: Date,
    endDate: Date,
  ): Promise<{ channel: string; revenue: number; conversions: number }[]>;
  delete(id: string): Promise<boolean>;
  count(filter: AttributionFilter): Promise<number>;
}
