/**
 * SMS Provider Port (Interface)
 * Defines contract for SMS sending implementations (Twilio, etc.)
 *
 * @interface ISmsProvider
 */

export interface SmsSendResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
  timestamp: Date;
}

/**
 * Port interface for SMS sending
 * Implementations provide SMS service integration (Twilio, etc.)
 */
export interface ISmsProvider {
  /**
   * Send an SMS
   *
   * @param to - Recipient phone number (international format with country code)
   * @param body - SMS message body (max 160 characters for standard SMS)
   * @param options - Additional options
   * @returns SMS send result with messageId and status
   * @throws {Error} If SMS sending fails
   */
  sendSms(
    to: string,
    body: string,
    options?: {
      from?: string;
      messageType?: 'standard' | 'unicode' | 'flash';
      validity?: number; // Message validity in minutes
      tags?: Record<string, string>;
    }
  ): Promise<SmsSendResult>;

  /**
   * Send SMS to multiple recipients
   *
   * @param recipients - Array of recipient phone numbers
   * @param body - SMS message body
   * @param options - Additional options
   * @returns Array of send results
   */
  sendBulk(
    recipients: string[],
    body: string,
    options?: {
      from?: string;
      messageType?: 'standard' | 'unicode' | 'flash';
    }
  ): Promise<SmsSendResult[]>;

  /**
   * Get SMS character count and number of parts
   * Useful for displaying character count in UI
   *
   * @param body - Message body
   * @returns Object with characterCount and messageParts
   */
  getMessageInfo(body: string): { characterCount: number; messageParts: number };

  /**
   * Test SMS provider connectivity
   *
   * @returns True if provider is accessible and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider name
   *
   * @returns Name of the SMS provider (Twilio, etc.)
   */
  getProviderName(): string;
}
