/**
 * ICampaignStepRepository
 * Port interface for campaign step persistence operations
 */
import { CampaignStep } from '../entities/CampaignStep';

export interface ICampaignStepRepository {
  save(step: CampaignStep): Promise<CampaignStep>;
  findById(id: string): Promise<CampaignStep | null>;
  findByCampaign(campaignId: string): Promise<CampaignStep[]>;
  findByCampaignAndOrder(campaignId: string, stepOrder: number): Promise<CampaignStep | null>;
  updateStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<boolean>;
  deleteAllByCampaign(campaignId: string): Promise<number>;
  count(campaignId: string): Promise<number>;
  getNextStepOrder(campaignId: string): Promise<number>;
}
