/**
 * WhatsApp Agent Domain Entity
 *
 * Represents a support agent handling WhatsApp conversations.
 * Manages agent status, active/assigned conversation counts.
 *
 * @module whatsapp/domain/entities
 */

/**
 * Agent status.
 */
export type AgentStatus = 'online' | 'away' | 'offline';

/**
 * WhatsApp Agent entity.
 *
 * Core domain entity representing a support agent.
 * Tracks agent availability status and workload (active/assigned conversations).
 *
 * @class WhatsAppAgent
 */
export class WhatsAppAgent {
  /**
   * Create a new WhatsApp agent.
   *
   * @param id - Unique agent ID in ERP system (typically user ID)
   * @param name - Agent name
   * @param status - Current availability status
   * @param email - Agent email (optional)
   * @param avatar - Profile image URL (optional)
   * @param activeConversations - Number of conversations currently being handled
   * @param assignedConversations - Total assigned conversations (including pending)
   * @param lastStatusUpdate - When status was last updated
   * @param createdAt - Agent creation timestamp
   * @param updatedAt - Last update timestamp
   */
  constructor(
    readonly id: string,
    private name: string,
    private status: AgentStatus,
    private email?: string,
    private avatar?: string,
    private activeConversations: number = 0,
    private assignedConversations: number = 0,
    private lastStatusUpdate: Date = new Date(),
    readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {}

  /**
   * Set agent availability status.
   *
   * @param status - New status (online, away, offline)
   */
  setStatus(status: AgentStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.lastStatusUpdate = new Date();
      this.updatedAt = new Date();
    }
  }

  /**
   * Increment active conversations count.
   * Called when agent picks up a conversation.
   */
  incrementActive(): void {
    this.activeConversations++;
    if (this.activeConversations > this.assignedConversations) {
      this.assignedConversations = this.activeConversations;
    }
    this.updatedAt = new Date();
  }

  /**
   * Decrement active conversations count.
   * Called when agent completes/resolves a conversation.
   */
  decrementActive(): void {
    if (this.activeConversations > 0) {
      this.activeConversations--;
    }
    this.updatedAt = new Date();
  }

  /**
   * Increment assigned conversations count.
   * Called when a new conversation is assigned to this agent.
   */
  incrementAssigned(): void {
    this.assignedConversations++;
    this.updatedAt = new Date();
  }

  /**
   * Decrement assigned conversations count.
   * Called when a conversation is reassigned or deleted.
   */
  decrementAssigned(): void {
    if (this.assignedConversations > 0) {
      this.assignedConversations--;
    }
    // Active cannot exceed assigned
    if (this.activeConversations > this.assignedConversations) {
      this.activeConversations = this.assignedConversations;
    }
    this.updatedAt = new Date();
  }

  /**
   * Update agent profile information.
   *
   * @param name - New name
   * @param email - New email
   * @param avatar - New avatar URL
   */
  updateProfile(name?: string, email?: string, avatar?: string): void {
    if (name) {
      this.name = name;
    }
    if (email !== undefined) {
      this.email = email;
    }
    if (avatar !== undefined) {
      this.avatar = avatar;
    }
    this.updatedAt = new Date();
  }

  /**
   * Check if agent is available to take new conversations.
   * Online or away agents can handle new conversations.
   *
   * @returns True if agent is available
   */
  isAvailable(): boolean {
    return this.status === 'online' || this.status === 'away';
  }

  /**
   * Get current status.
   * @internal
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent name.
   * @internal
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get agent email.
   * @internal
   */
  getEmail(): string | undefined {
    return this.email;
  }

  /**
   * Get avatar URL.
   * @internal
   */
  getAvatar(): string | undefined {
    return this.avatar;
  }

  /**
   * Get active conversations count.
   * @internal
   */
  getActiveConversations(): number {
    return this.activeConversations;
  }

  /**
   * Get assigned conversations count.
   * @internal
   */
  getAssignedConversations(): number {
    return this.assignedConversations;
  }

  /**
   * Get last status update timestamp.
   * @internal
   */
  getLastStatusUpdate(): Date {
    return this.lastStatusUpdate;
  }

  /**
   * Get last update timestamp.
   * @internal
   */
  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  /**
   * Convert to plain object for API responses.
   *
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status,
      activeConversations: this.activeConversations,
      assignedConversations: this.assignedConversations,
      avatar: this.avatar,
      lastStatusUpdate: this.lastStatusUpdate.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
