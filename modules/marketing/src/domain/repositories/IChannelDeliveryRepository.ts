/**
 * IChannelDeliveryRepository
 * Port interface for channel delivery persistence operations
 */
import { ChannelDelivery } from '../entities/ChannelDelivery';

export interface DeliveryFilter {
  campaignId?: string;
  stepId?: string;
  customerId?: string;
  channel?: string;
  status?: string;
  sentAfter?: Date;
  sentBefore?: Date;
}

export interface IChannelDeliveryRepository {
  save(delivery: ChannelDelivery): Promise<ChannelDelivery>;
  bulkSave(deliveries: ChannelDelivery[]): Promise<ChannelDelivery[]>;
  findById(id: string): Promise<ChannelDelivery | null>;
  findByCampaign(
    campaignId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ChannelDelivery[]; total: number; page: number; pages: number }>;
  findByFilter(
    filter: DeliveryFilter,
    pagination: { page: number; limit: number },
  ): Promise<{ items: ChannelDelivery[]; total: number; page: number; pages: number }>;
  findQueued(limit: number): Promise<ChannelDelivery[]>;
  findRetryable(): Promise<ChannelDelivery[]>;
  updateStatus(id: string, status: string): Promise<void>;
  countByCampaign(campaignId: string): Promise<Record<string, number>>;
  delete(id: string): Promise<boolean>;
}
