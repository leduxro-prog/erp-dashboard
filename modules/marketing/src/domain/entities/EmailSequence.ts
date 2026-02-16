/**
 * EmailSequence Domain Entity
 * Represents a series of automated emails triggered by customer events.
 *
 * @module Domain/Entities
 */

import { EmailSequenceStep } from './EmailSequenceStep';

/**
 * Email sequence trigger event type
 */
export type SequenceTriggerEvent =
  | 'REGISTRATION'
  | 'FIRST_ORDER'
  | 'CART_ABANDONED'
  | 'POST_PURCHASE'
  | 'REACTIVATION'
  | 'BIRTHDAY'
  | 'TIER_UPGRADE';

/**
 * Email sequence status
 */
export type SequenceStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

/**
 * EmailSequence Domain Entity
 *
 * Encapsulates email sequence data with business logic for:
 * - Multi-step email sequences
 * - Trigger-based enrollment
 * - Step progression and completion tracking
 *
 * @class EmailSequence
 */
export class EmailSequence {
  /**
   * Create a new EmailSequence entity
   *
   * @param id - Unique sequence identifier
   * @param campaignId - Associated campaign ID
   * @param name - Sequence name
   * @param triggerEvent - Event that triggers enrollment
   * @param steps - Ordered array of email steps
   * @param status - Current sequence status
   * @param enrolledCount - Total customers enrolled
   * @param completedCount - Total customers completed sequence
   * @param createdAt - Creation timestamp
   */
  constructor(
    readonly id: string,
    readonly campaignId: string,
    readonly name: string,
    readonly triggerEvent: SequenceTriggerEvent,
    private steps: EmailSequenceStep[],
    private status: SequenceStatus,
    readonly enrolledCount: number,
    readonly completedCount: number,
    readonly createdAt: Date
  ) { }

  /**
   * Get current sequence status
   * @returns Current status
   */
  getStatus(): SequenceStatus {
    return this.status;
  }

  /**
   * Check if sequence is active
   * @returns True if status is ACTIVE
   */
  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  /**
   * Activate the sequence
   * @throws Error if already active
   */
  activate(): void {
    if (this.status === 'ACTIVE') {
      throw new Error('Sequence is already active');
    }
    this.status = 'ACTIVE';
  }

  /**
   * Pause the sequence
   * Stops enrolling new customers
   *
   * @throws Error if not active
   */
  pause(): void {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot pause sequence with status ${this.status}`);
    }
    this.status = 'PAUSED';
  }

  /**
   * Resume a paused sequence
   * @throws Error if not paused
   */
  resume(): void {
    if (this.status !== 'PAUSED') {
      throw new Error(`Cannot resume sequence with status ${this.status}`);
    }
    this.status = 'ACTIVE';
  }

  /**
   * Get all sequence steps
   * @returns Array of email sequence steps
   */
  getSteps(): EmailSequenceStep[] {
    return [...this.steps];
  }

  /**
   * Add a new step to the sequence
   * @param step - Email sequence step to add
   */
  addStep(step: EmailSequenceStep): void {
    this.steps.push(step);
  }

  /**
   * Remove a step from the sequence
   * @param index - Index of step to remove
   * @throws Error if index out of bounds
   */
  removeStep(index: number): void {
    if (index < 0 || index >= this.steps.length) {
      throw new Error(`Step index ${index} out of bounds`);
    }
    this.steps.splice(index, 1);
  }

  /**
   * Reorder sequence steps
   * @param newOrder - Array of step IDs in new order
   * @throws Error if IDs don't match existing steps
   */
  reorderSteps(newOrder: string[]): void {
    if (newOrder.length !== this.steps.length) {
      throw new Error('Reorder array length does not match number of steps');
    }

    const stepMap = new Map(this.steps.map((s) => [s.id, s]));
    const reordered = newOrder
      .map((id) => stepMap.get(id))
      .filter((step) => step !== undefined) as EmailSequenceStep[];

    if (reordered.length !== this.steps.length) {
      throw new Error('Invalid step IDs in reorder');
    }

    this.steps = reordered;
  }

  /**
   * Get the next step after current step
   * @param currentStepIndex - Index of current step
   * @returns Next step, or null if at end
   */
  getNextStep(currentStepIndex: number): EmailSequenceStep | null {
    if (currentStepIndex + 1 >= this.steps.length) {
      return null;
    }
    return this.steps[currentStepIndex + 1];
  }

  /**
   * Get first step in sequence
   * @returns First email sequence step
   * @throws Error if sequence has no steps
   */
  getFirstStep(): EmailSequenceStep {
    if (this.steps.length === 0) {
      throw new Error('Sequence has no steps');
    }
    return this.steps[0];
  }

  /**
   * Check if sequence is complete (all steps executed)
   * @param completedStepCount - Number of steps completed by customer
   * @returns True if customer completed all steps
   */
  isComplete(completedStepCount: number): boolean {
    return completedStepCount >= this.steps.length;
  }

  /**
   * Get sequence completion rate
   * @returns Completion rate as percentage (0-100)
   */
  getCompletionRate(): number {
    if (this.enrolledCount === 0) {
      return 0;
    }
    return (this.completedCount / this.enrolledCount) * 100;
  }

  /**
   * Get step count
   * @returns Number of steps in sequence
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Get total time to complete sequence
   * Sums up all delays in sequence
   *
   * @returns Total time in hours
   */
  getTotalDuration(): number {
    return this.steps.reduce((total, step) => {
      return total + (step.getDelayDays() * 24 + step.getDelayHours());
    }, 0);
  }
}
