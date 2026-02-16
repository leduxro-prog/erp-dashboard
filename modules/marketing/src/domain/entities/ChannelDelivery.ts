/**
 * ChannelDelivery Domain Entity
 * Tracks individual message delivery per channel per customer.
 *
 * @module Domain/Entities
 */

import { CampaignChannel } from './CampaignStep';

export type DeliveryStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'BOUNCED'
  | 'FAILED'
  | 'UNSUBSCRIBED'
  | 'RETRYING';

export class ChannelDelivery {
  constructor(
    readonly id: string,
    readonly campaignId: string,
    readonly stepId: string | null,
    readonly customerId: string,
    readonly channel: CampaignChannel,
    private status: DeliveryStatus,
    readonly recipientAddress: string,
    readonly templateId: string | null,
    readonly templateData: Record<string, unknown>,
    readonly externalMessageId: string | null,
    readonly sentAt: Date | null,
    readonly deliveredAt: Date | null,
    readonly openedAt: Date | null,
    readonly clickedAt: Date | null,
    readonly failedAt: Date | null,
    readonly failureReason: string | null,
    private retryCount: number,
    readonly maxRetries: number,
    readonly cost: number,
    readonly metadata: Record<string, unknown>,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  getStatus(): DeliveryStatus {
    return this.status;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  markSending(): void {
    if (this.status !== 'QUEUED' && this.status !== 'RETRYING') {
      throw new Error(`Cannot mark as sending from status ${this.status}.`);
    }
    this.status = 'SENDING';
  }

  markSent(): void {
    if (this.status !== 'SENDING') {
      throw new Error(`Cannot mark as sent from status ${this.status}.`);
    }
    this.status = 'SENT';
  }

  markDelivered(): void {
    this.status = 'DELIVERED';
  }

  markOpened(): void {
    this.status = 'OPENED';
  }

  markClicked(): void {
    this.status = 'CLICKED';
  }

  markBounced(): void {
    this.status = 'BOUNCED';
  }

  markFailed(reason: string): void {
    this.status = 'FAILED';
  }

  canRetry(): boolean {
    return (
      (this.status === 'FAILED' || this.status === 'BOUNCED') && this.retryCount < this.maxRetries
    );
  }

  retry(): void {
    if (!this.canRetry()) {
      throw new Error(
        `Cannot retry delivery (status: ${this.status}, retries: ${this.retryCount}/${this.maxRetries}).`,
      );
    }
    this.retryCount++;
    this.status = 'RETRYING';
  }

  isTerminal(): boolean {
    return ['DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED', 'UNSUBSCRIBED'].includes(
      this.status,
    );
  }

  isEngaged(): boolean {
    return this.status === 'OPENED' || this.status === 'CLICKED';
  }
}
