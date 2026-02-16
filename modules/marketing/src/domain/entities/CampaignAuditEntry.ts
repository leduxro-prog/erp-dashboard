/**
 * CampaignAuditEntry Domain Entity
 * Records audit trail for campaign lifecycle events.
 *
 * @module Domain/Entities
 */

export class CampaignAuditEntry {
  constructor(
    readonly id: string,
    readonly campaignId: string,
    readonly action: string,
    readonly actorId: string,
    readonly previousState: Record<string, unknown> | null,
    readonly newState: Record<string, unknown> | null,
    readonly details: Record<string, unknown>,
    readonly ipAddress: string | null,
    readonly createdAt: Date,
  ) {}

  static create(params: {
    id: string;
    campaignId: string;
    action: string;
    actorId: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): CampaignAuditEntry {
    return new CampaignAuditEntry(
      params.id,
      params.campaignId,
      params.action,
      params.actorId,
      params.previousState || null,
      params.newState || null,
      params.details || {},
      params.ipAddress || null,
      new Date(),
    );
  }
}
