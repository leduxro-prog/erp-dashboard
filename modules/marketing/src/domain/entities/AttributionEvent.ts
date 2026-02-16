/**
 * AttributionEvent Domain Entity
 * Tracks touchpoints and attribution for conversions.
 *
 * @module Domain/Entities
 */

import { CampaignChannel } from './CampaignStep';

export type AttributionType = 'FIRST_TOUCH' | 'LAST_TOUCH' | 'ASSISTED' | 'LINEAR' | 'TIME_DECAY';

export class AttributionEvent {
  constructor(
    readonly id: string,
    readonly campaignId: string | null,
    readonly customerId: string,
    readonly channel: CampaignChannel,
    readonly attributionType: AttributionType,
    readonly touchpointType: string,
    readonly touchpointUrl: string | null,
    readonly utmSource: string | null,
    readonly utmMedium: string | null,
    readonly utmCampaign: string | null,
    readonly utmContent: string | null,
    readonly utmTerm: string | null,
    readonly clickId: string | null,
    readonly orderId: string | null,
    readonly revenue: number,
    readonly cost: number,
    readonly isConversion: boolean,
    readonly conversionValue: number | null,
    readonly sessionId: string | null,
    readonly metadata: Record<string, unknown>,
    readonly touchpointAt: Date,
    readonly createdAt: Date,
  ) {}

  getROAS(): number {
    if (this.cost === 0) return 0;
    return this.revenue / this.cost;
  }

  hasUtmData(): boolean {
    return !!(this.utmSource || this.utmMedium || this.utmCampaign);
  }

  isOrganic(): boolean {
    return this.utmMedium === 'organic' || (!this.utmSource && !this.clickId);
  }

  isPaid(): boolean {
    return ['cpc', 'ppc', 'paid', 'display'].includes(this.utmMedium || '');
  }
}
