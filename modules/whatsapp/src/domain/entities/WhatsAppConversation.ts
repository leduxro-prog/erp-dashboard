/**
 * WhatsApp Conversation Domain Entity
 *
 * Represents a conversation thread between the business and a customer.
 * Manages conversation lifecycle, message tracking, and user assignment.
 *
 * @module whatsapp/domain/entities
 */

/**
 * Conversation status.
 */
export type ConversationStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'RESOLVED'
  | 'ARCHIVED';

/**
 * Priority level for conversations.
 */
export type ConversationPriority = 'LOW' | 'NORMAL' | 'HIGH';

/**
 * WhatsApp Conversation entity.
 *
 * Core domain entity representing a conversation thread.
 * Tracks conversation lifecycle: open, assign to agent, resolve, archive.
 *
 * @class WhatsAppConversation
 */
export class WhatsAppConversation {
  /**
   * Create a new WhatsApp conversation.
   *
   * @param id - Unique conversation ID in ERP system
   * @param customerId - ID of the customer (optional, resolved by phone)
   * @param customerName - Name of the customer
   * @param customerPhone - Phone number of the customer
   * @param status - Current conversation status
   * @param createdAt - Conversation creation timestamp
   * @param updatedAt - Last update timestamp
   * @param assignedToUserId - ID of the assigned support user (optional)
   * @param lastMessageAt - Timestamp of last message
   * @param messageCount - Total number of messages
   * @param unreadCount - Number of unread messages
   * @param tags - Tags for categorization
   * @param priority - Priority level
   */
  constructor(
    readonly id: string,
    private customerId: string | null,
    readonly customerName: string,
    readonly customerPhone: string,
    private status: ConversationStatus,
    readonly createdAt: Date,
    private updatedAt: Date,
    private assignedToUserId?: string,
    private lastMessageAt?: Date,
    private messageCount: number = 0,
    private unreadCount: number = 0,
    private tags: string[] = [],
    private priority: ConversationPriority = 'NORMAL'
  ) {}

  /**
   * Assign conversation to a support agent.
   *
   * @param userId - ID of the support agent
   * @throws {Error} If conversation is already resolved or archived
   */
  assign(userId: string): void {
    if (this.status === 'RESOLVED' || this.status === 'ARCHIVED') {
      throw new Error(
        `Cannot assign a ${this.status.toLowerCase()} conversation`
      );
    }
    this.assignedToUserId = userId;
    this.status = 'ASSIGNED';
    this.updatedAt = new Date();
  }

  /**
   * Mark conversation as resolved.
   * Support agent has finished handling the conversation.
   */
  resolve(): void {
    if (this.status === 'ARCHIVED') {
      throw new Error('Cannot resolve an archived conversation');
    }
    this.status = 'RESOLVED';
    this.updatedAt = new Date();
  }

  /**
   * Reopen a resolved conversation.
   * Customer sent a new message or issue not resolved.
   */
  reopen(): void {
    if (this.status !== 'RESOLVED') {
      return; // Idempotent
    }
    this.status = 'OPEN';
    this.updatedAt = new Date();
  }

  /**
   * Archive a resolved conversation.
   * Typically done 7 days after resolution.
   *
   * @throws {Error} If conversation is not resolved
   */
  archive(): void {
    if (this.status !== 'RESOLVED') {
      throw new Error('Can only archive resolved conversations');
    }
    this.status = 'ARCHIVED';
    this.updatedAt = new Date();
  }

  /**
   * Record a new message in this conversation.
   * Updates message count and last message timestamp.
   */
  addMessage(): void {
    this.messageCount++;
    this.unreadCount++;
    this.lastMessageAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark all messages as read.
   */
  markRead(): void {
    if (this.unreadCount > 0) {
      this.unreadCount = 0;
      this.updatedAt = new Date();
    }
  }

  /**
   * Add a tag to the conversation.
   * Tags are used for categorization and filtering.
   *
   * @param tag - Tag to add
   */
  addTag(tag: string): void {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  /**
   * Remove a tag from the conversation.
   *
   * @param tag - Tag to remove
   */
  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  /**
   * Set the priority level.
   *
   * @param priority - New priority level
   */
  setPriority(priority: ConversationPriority): void {
    if (this.priority !== priority) {
      this.priority = priority;
      this.updatedAt = new Date();
    }
  }

  /**
   * Set the customer ID.
   * Called when customer is identified by phone number.
   *
   * @param id - Customer ID
   */
  setCustomerId(id: string): void {
    if (this.customerId !== id) {
      this.customerId = id;
      this.updatedAt = new Date();
    }
  }

  /**
   * Check if conversation is active (open or assigned).
   * @returns True if conversation can receive new messages
   */
  isActive(): boolean {
    return this.status === 'OPEN' || this.status === 'ASSIGNED';
  }

  /**
   * Get current status.
   * @internal
   */
  getStatus(): ConversationStatus {
    return this.status;
  }

  /**
   * Get assigned user ID.
   * @internal
   */
  getAssignedToUserId(): string | undefined {
    return this.assignedToUserId;
  }

  /**
   * Get customer ID.
   * @internal
   */
  getCustomerId(): string | null {
    return this.customerId;
  }

  /**
   * Get message count.
   * @internal
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Get unread message count.
   * @internal
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Get tags.
   * @internal
   */
  getTags(): string[] {
    return [...this.tags];
  }

  /**
   * Get priority.
   * @internal
   */
  getPriority(): ConversationPriority {
    return this.priority;
  }

  /**
   * Get last message timestamp.
   * @internal
   */
  getLastMessageAt(): Date | undefined {
    return this.lastMessageAt;
  }

  /**
   * Get last update timestamp.
   * @internal
   */
  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
