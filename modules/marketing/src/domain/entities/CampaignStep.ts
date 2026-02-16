/**
 * CampaignStep Domain Entity
 * Represents a step in a multi-step campaign journey.
 *
 * @module Domain/Entities
 */

export type StepType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'SEND_WHATSAPP'
  | 'SEND_PUSH'
  | 'WAIT'
  | 'CONDITION'
  | 'SPLIT'
  | 'WEBHOOK';

export type StepStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export type CampaignChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'SOCIAL' | 'DISPLAY';

export class CampaignStep {
  constructor(
    readonly id: string,
    readonly campaignId: string,
    readonly stepOrder: number,
    readonly stepType: StepType,
    private status: StepStatus,
    readonly name: string,
    readonly description: string | null,
    readonly channel: CampaignChannel | null,
    readonly templateId: string | null,
    readonly templateData: Record<string, unknown>,
    readonly delayMinutes: number,
    readonly conditionRules: Record<string, unknown> | null,
    readonly splitConfig: Record<string, unknown> | null,
    readonly webhookUrl: string | null,
    private retryCount: number,
    readonly maxRetries: number,
    readonly startedAt: Date | null,
    readonly completedAt: Date | null,
    readonly metadata: Record<string, unknown>,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  getStatus(): StepStatus {
    return this.status;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  activate(): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot activate step with status ${this.status}. Must be PENDING.`);
    }
    this.status = 'ACTIVE';
  }

  complete(): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot complete step with status ${this.status}. Must be ACTIVE.`);
    }
    this.status = 'COMPLETED';
  }

  skip(): void {
    if (this.status === 'COMPLETED' || this.status === 'FAILED') {
      throw new Error(`Cannot skip step with status ${this.status}.`);
    }
    this.status = 'SKIPPED';
  }

  fail(): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot fail step with status ${this.status}. Must be ACTIVE.`);
    }
    this.status = 'FAILED';
  }

  canRetry(): boolean {
    return this.status === 'FAILED' && this.retryCount < this.maxRetries;
  }

  incrementRetry(): void {
    if (!this.canRetry()) {
      throw new Error(
        `Step cannot be retried (retryCount: ${this.retryCount}, max: ${this.maxRetries}).`,
      );
    }
    this.retryCount++;
    this.status = 'ACTIVE';
  }

  isSendStep(): boolean {
    return ['SEND_EMAIL', 'SEND_SMS', 'SEND_WHATSAPP', 'SEND_PUSH'].includes(this.stepType);
  }

  isWaitStep(): boolean {
    return this.stepType === 'WAIT';
  }

  isConditionStep(): boolean {
    return this.stepType === 'CONDITION' || this.stepType === 'SPLIT';
  }
}
