/**
 * NotificationPreference Domain Entity
 * Manages customer notification preferences including channels, frequency, and quiet hours
 *
 * Handles preference validation and delivery eligibility checks.
 *
 * @class NotificationPreference
 */
export type NotificationFrequency = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST';
export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';

export interface QuietHours {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface NotificationPreferenceProps {
  id?: string;
  customerId: string;
  channel: NotificationChannel;
  isEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  frequency: NotificationFrequency;
  createdAt?: Date;
  updatedAt?: Date;
}

export class NotificationPreference {
  readonly id: string;
  readonly customerId: string;
  readonly channel: NotificationChannel;

  private isEnabled: boolean;
  private quietHoursStart?: string;
  private quietHoursEnd?: string;
  private frequency: NotificationFrequency;
  private createdAt: Date;
  private updatedAt: Date;

  /**
   * Create a new NotificationPreference entity
   *
   * @param props - Preference properties
   * @throws {Error} If required properties are missing or invalid
   */
  constructor(props: NotificationPreferenceProps) {
    if (!props.id) {
      throw new Error('Preference ID is required');
    }
    if (!props.customerId) {
      throw new Error('Customer ID is required');
    }
    if (!props.channel) {
      throw new Error('Channel is required');
    }

    this.id = props.id;
    this.customerId = props.customerId;
    this.channel = props.channel;
    this.isEnabled = props.isEnabled;
    this.quietHoursStart = props.quietHoursStart;
    this.quietHoursEnd = props.quietHoursEnd;
    this.frequency = props.frequency;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();

    this.validateQuietHours();
  }

  /**
   * Validate quiet hours format (HH:mm)
   *
   * @throws {Error} If quiet hours format is invalid
   */
  private validateQuietHours(): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (this.quietHoursStart && !timeRegex.test(this.quietHoursStart)) {
      throw new Error('Invalid quietHoursStart format. Expected HH:mm');
    }

    if (this.quietHoursEnd && !timeRegex.test(this.quietHoursEnd)) {
      throw new Error('Invalid quietHoursEnd format. Expected HH:mm');
    }

    // If both are set, start should be before end (or end is next day)
    if (this.quietHoursStart && this.quietHoursEnd) {
      const start = this.timeToMinutes(this.quietHoursStart);
      const end = this.timeToMinutes(this.quietHoursEnd);

      // Allow end < start for overnight quiet hours (e.g., 22:00 to 08:00)
      // This is valid
    }
  }

  /**
   * Convert time string to minutes since midnight
   *
   * @param time - Time in HH:mm format
   * @returns Minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if current time is within quiet hours
   *
   * @param time - Optional time to check (defaults to current time)
   * @returns True if currently in quiet hours
   */
  isQuietHours(time?: Date): boolean {
    if (!this.quietHoursStart || !this.quietHoursEnd) {
      return false;
    }

    const checkTime = time || new Date();
    const currentMinutes =
      checkTime.getHours() * 60 + checkTime.getMinutes();

    const startMinutes = this.timeToMinutes(this.quietHoursStart);
    const endMinutes = this.timeToMinutes(this.quietHoursEnd);

    // Overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    // Normal quiet hours (e.g., 08:00 to 12:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  /**
   * Check if notification is allowed on this channel at this time
   * Considers both enabled status and quiet hours
   *
   * @param channel - Channel to check
   * @param time - Optional time to check
   * @returns True if notification can be sent
   */
  isAllowed(channel?: NotificationChannel, time?: Date): boolean {
    if (!this.isEnabled) {
      return false;
    }

    // Check channel matches if specified
    if (channel && channel !== this.channel) {
      return false;
    }

    // Check quiet hours
    if (this.isQuietHours(time)) {
      return false;
    }

    return true;
  }

  /**
   * Check if notification can be sent based on frequency
   * Returns false for DAILY_DIGEST and WEEKLY_DIGEST
   *
   * @returns True if notifications can be sent immediately
   */
  canSendImmediate(): boolean {
    return this.frequency === 'IMMEDIATE';
  }

  /**
   * Get notification frequency
   *
   * @returns Current frequency setting
   */
  getFrequency(): NotificationFrequency {
    return this.frequency;
  }

  /**
   * Update frequency setting
   *
   * @param frequency - New frequency
   */
  setFrequency(frequency: NotificationFrequency): void {
    this.frequency = frequency;
    this.updatedAt = new Date();
  }

  /**
   * Enable the preference
   */
  enable(): void {
    this.isEnabled = true;
    this.updatedAt = new Date();
  }

  /**
   * Disable the preference
   */
  disable(): void {
    this.isEnabled = false;
    this.updatedAt = new Date();
  }

  /**
   * Check if preference is enabled
   *
   * @returns Whether preference is enabled
   */
  getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set quiet hours
   *
   * @param start - Start time in HH:mm format
   * @param end - End time in HH:mm format
   * @throws {Error} If time format is invalid
   */
  setQuietHours(start: string, end: string): void {
    this.quietHoursStart = start;
    this.quietHoursEnd = end;
    this.validateQuietHours();
    this.updatedAt = new Date();
  }

  /**
   * Clear quiet hours
   */
  clearQuietHours(): void {
    this.quietHoursStart = undefined;
    this.quietHoursEnd = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Get preference for JSON serialization
   *
   * @returns Plain object representation
   */
  toJSON(): NotificationPreferenceProps {
    return {
      id: this.id,
      customerId: this.customerId,
      channel: this.channel,
      isEnabled: this.isEnabled,
      quietHoursStart: this.quietHoursStart,
      quietHoursEnd: this.quietHoursEnd,
      frequency: this.frequency,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
