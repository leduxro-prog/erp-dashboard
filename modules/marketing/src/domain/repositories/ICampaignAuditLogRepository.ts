/**
 * ICampaignAuditLogRepository
 * Port interface for campaign audit log persistence
 */
import { CampaignAuditEntry } from '../entities/CampaignAuditEntry';

export interface ICampaignAuditLogRepository {
  save(entry: CampaignAuditEntry): Promise<CampaignAuditEntry>;
  findByCampaign(
    campaignId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ items: CampaignAuditEntry[]; total: number; page: number; pages: number }>;
  findByActor(actorId: string, limit: number): Promise<CampaignAuditEntry[]>;
  findByAction(action: string, limit: number): Promise<CampaignAuditEntry[]>;
  count(campaignId: string): Promise<number>;
}
