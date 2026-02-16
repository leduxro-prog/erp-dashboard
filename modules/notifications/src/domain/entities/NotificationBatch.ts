/**
 * NotificationBatch Domain Entity
 * Manages bulk notification sending with progress tracking
 *
 * Handles batch lifecycle: creation, notification addition, completion, and progress monitoring.
 *
 * @class NotificationBatch
 */
export type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface NotificationBatchProps {
  id?: string;
  name: string;
  notifications: string[]; // Array of notification IDs
  status: BatchStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class NotificationBatch {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;

  private notifications: string[];
  private status: BatchStatus;
  private totalCount: number;
  private sentCount: number;
  private failedCount: number;
  private startedAt?: Date;
  private completedAt?: Date;
  private updatedAt: Date;

  /**
   * Create a new NotificationBatch entity
   *
   * @param props - Batch properties
   * @throws {Error} If required properties are missing
   */
  constructor(props: NotificationBatchProps) {
    if (!props.id) {
      throw new Error('Batch ID is required');
    }
    if (!props.name) {
      throw new Error('Batch name is required');
    }

    this.id = props.id;
    this.name = props.name;
    this.notifications = props.notifications || [];
    this.status = props.status;
    this.totalCount = props.totalCount;
    this.sentCount = props.sentCount;
    this.failedCount = props.failedCount;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  /**
   * Add a notification to the batch
   *
   * @param notificationId - ID of notification to add
   * @throws {Error} If batch is already processing
   */
  addNotification(notificationId: string): void {
    if (this.status === 'PROCESSING' || this.status === 'COMPLETED') {
      throw new Error(
        `Cannot add notification to batch with status: ${this.status}`
      );
    }

    if (!this.notifications.includes(notificationId)) {
      this.notifications.push(notificationId);
      this.totalCount++;
      this.updatedAt = new Date();
    }
  }

  /**
   * Start processing the batch
   *
   * @throws {Error} If batch is not pending
   */
  startProcessing(): void {
    if (this.status !== 'PENDING') {
      throw new Error(
        `Cannot start processing batch with status: ${this.status}. Expected: PENDING`
      );
    }

    this.status = 'PROCESSING';
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark batch as completed
   *
   * @throws {Error} If batch is not processing
   */
  markComplete(): void {
    if (this.status !== 'PROCESSING') {
      throw new Error(
        `Cannot complete batch with status: ${this.status}. Expected: PROCESSING`
      );
    }

    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark batch as failed
   *
   * @throws {Error} If batch is not processing
   */
  markFailed(): void {
    if (this.status !== 'PROCESSING') {
      throw new Error(
        `Cannot fail batch with status: ${this.status}. Expected: PROCESSING`
      );
    }

    this.status = 'FAILED';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Cancel the batch
   *
   * @throws {Error} If batch is already completed
   */
  cancel(): void {
    if (this.status === 'COMPLETED' || this.status === 'FAILED') {
      throw new Error(
        `Cannot cancel batch with status: ${this.status}. Already finalized`
      );
    }

    this.status = 'CANCELLED';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark a notification as successfully sent
   *
   * @param notificationId - ID of sent notification
   */
  recordSent(notificationId: string): void {
    if (this.notifications.includes(notificationId)) {
      this.sentCount++;
      this.updatedAt = new Date();
    }
  }

  /**
   * Mark a notification as failed
   *
   * @param notificationId - ID of failed notification
   */
  recordFailed(notificationId: string): void {
    if (this.notifications.includes(notificationId)) {
      this.failedCount++;
      this.updatedAt = new Date();
    }
  }

  /**
   * Get batch progress as percentage
   *
   * @returns Progress percentage (0-100)
   */
  getProgress(): number {
    if (this.totalCount === 0) {
      return 0;
    }

    const processed = this.sentCount + this.failedCount;
    return Math.round((processed / this.totalCount) * 100);
  }

  /**
   * Check if batch processing is complete
   *
   * @returns True if all notifications have been processed
   */
  isComplete(): boolean {
    return (this.sentCount + this.failedCount) === this.totalCount;
  }

  /**
   * Get batch status
   *
   * @returns Current status
   */
  getStatus(): BatchStatus {
    return this.status;
  }

  /**
   * Get notifications in batch
   *
   * @returns Array of notification IDs
   */
  getNotifications(): string[] {
    return [...this.notifications];
  }

  /**
   * Get batch statistics
   *
   * @returns Object with sent, failed, pending counts and progress
   */
  getStats(): {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    progress: number;
  } {
    const pending = this.totalCount - this.sentCount - this.failedCount;

    return {
      total: this.totalCount,
      sent: this.sentCount,
      failed: this.failedCount,
      pending,
      progress: this.getProgress(),
    };
  }

  /**
   * Get batch for JSON serialization
   *
   * @returns Plain object representation
   */
  toJSON(): NotificationBatchProps {
    return {
      id: this.id,
      name: this.name,
      notifications: [...this.notifications],
      status: this.status,
      totalCount: this.totalCount,
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
