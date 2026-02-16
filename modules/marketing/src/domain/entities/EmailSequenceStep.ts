/**
 * EmailSequenceStep Domain Entity
 * Represents a single email in an automated sequence.
 *
 * @module Domain/Entities
 */

/**
 * Condition for sending a step email
 */
export type StepCondition =
  | 'IF_OPENED_PREVIOUS'
  | 'IF_NOT_OPENED'
  | 'IF_CLICKED'
  | 'ALWAYS';

/**
 * EmailSequenceStep Domain Entity
 *
 * Encapsulates email step data with business logic for:
 * - Conditional step execution
 * - Metrics tracking (sent, opened, clicked)
 * - Step ordering and timing
 *
 * @class EmailSequenceStep
 */
export class EmailSequenceStep {
  /**
   * Create a new EmailSequenceStep entity
   *
   * @param id - Unique step identifier
   * @param sequenceId - Parent sequence ID
   * @param order - Step order in sequence (0-based)
   * @param delayDays - Delay before sending (days)
   * @param delayHours - Delay before sending (hours)
   * @param templateId - Email template ID
   * @param subject - Email subject
   * @param body - Email body HTML
   * @param condition - Condition for sending this step
   * @param sentCount - Number of times sent
   * @param openedCount - Number of times opened
   * @param clickedCount - Number of times clicked
   */
  constructor(
    readonly id: string,
    readonly sequenceId: string,
    readonly order: number,
    private delayDays: number,
    private delayHours: number,
    readonly templateId: string,
    readonly subject: string,
    readonly body: string,
    readonly condition: StepCondition,
    private sentCount: number,
    private openedCount: number,
    private clickedCount: number
  ) {}

  /**
   * Get delay in days
   * @returns Delay days value
   */
  getDelayDays(): number {
    return this.delayDays;
  }

  /**
   * Get delay in hours
   * @returns Delay hours value
   */
  getDelayHours(): number {
    return this.delayHours;
  }

  /**
   * Get total delay in hours
   * @returns Total delay (days * 24 + hours)
   */
  getTotalDelayHours(): number {
    return this.delayDays * 24 + this.delayHours;
  }

  /**
   * Set step delay
   * @param delayDays - Delay days
   * @param delayHours - Delay hours
   */
  setDelay(delayDays: number, delayHours: number): void {
    if (delayDays < 0 || delayHours < 0) {
      throw new Error('Delay values must be non-negative');
    }
    if (delayHours >= 24) {
      throw new Error('Delay hours must be less than 24');
    }
    this.delayDays = delayDays;
    this.delayHours = delayHours;
  }

  /**
   * Check if this step should be sent given previous step result
   * Evaluates condition logic
   *
   * @param previousStepWasOpened - Whether previous step was opened (null if first step)
   * @param previousStepWasClicked - Whether previous step was clicked (null if first step)
   * @returns True if step should be sent
   */
  shouldSend(previousStepWasOpened: boolean | null, previousStepWasClicked: boolean | null): boolean {
    switch (this.condition) {
      case 'ALWAYS':
        return true;
      case 'IF_OPENED_PREVIOUS':
        return previousStepWasOpened === true;
      case 'IF_NOT_OPENED':
        return previousStepWasOpened === false;
      case 'IF_CLICKED':
        return previousStepWasClicked === true;
      default:
        return true;
    }
  }

  /**
   * Get open rate for this step
   * @returns Open rate as percentage (0-100)
   */
  getOpenRate(): number {
    if (this.sentCount === 0) {
      return 0;
    }
    return (this.openedCount / this.sentCount) * 100;
  }

  /**
   * Get click rate for this step
   * @returns Click rate as percentage (0-100)
   */
  getClickRate(): number {
    if (this.sentCount === 0) {
      return 0;
    }
    return (this.clickedCount / this.sentCount) * 100;
  }

  /**
   * Get step engagement rate
   * @returns Engagement rate as percentage (0-100)
   */
  getEngagementRate(): number {
    if (this.sentCount === 0) {
      return 0;
    }
    const engaged = Math.max(this.openedCount, this.clickedCount);
    return (engaged / this.sentCount) * 100;
  }

  /**
   * Record step send
   * @internal Used by infrastructure layer
   */
  recordSend(): void {
    this.sentCount++;
  }

  /**
   * Record step open
   * @internal Used by infrastructure layer
   */
  recordOpen(): void {
    this.openedCount++;
  }

  /**
   * Record step click
   * @internal Used by infrastructure layer
   */
  recordClick(): void {
    this.clickedCount++;
  }
}
