/**
 * CustomerConsent Domain Entity
 * Per-channel consent tracking for GDPR/marketing compliance.
 *
 * @module Domain/Entities
 */

import { CampaignChannel } from './CampaignStep';

export class CustomerConsent {
  constructor(
    readonly id: string,
    readonly customerId: string,
    readonly channel: CampaignChannel,
    private isOptedIn: boolean,
    private optedInAt: Date | null,
    private optedOutAt: Date | null,
    readonly consentSource: string | null,
    readonly ipAddress: string | null,
    readonly metadata: Record<string, unknown>,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  getIsOptedIn(): boolean {
    return this.isOptedIn;
  }

  getOptedInAt(): Date | null {
    return this.optedInAt;
  }

  getOptedOutAt(): Date | null {
    return this.optedOutAt;
  }

  optIn(): void {
    if (this.isOptedIn) return;
    this.isOptedIn = true;
    this.optedInAt = new Date();
    this.optedOutAt = null;
  }

  optOut(): void {
    if (!this.isOptedIn) return;
    this.isOptedIn = false;
    this.optedOutAt = new Date();
  }

  canReceiveMessages(): boolean {
    return this.isOptedIn;
  }
}
