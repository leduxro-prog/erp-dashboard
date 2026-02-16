/**
 * Push Notification Provider Port (Interface)
 * Defines contract for web and mobile push notification implementations
 *
 * @interface IPushProvider
 */

export interface PushSendResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
  timestamp: Date;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  color?: string;
  sound?: string;
  clickAction?: string;
  data?: Record<string, string>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Port interface for push notification sending
 * Implementations provide web-push or mobile push service integration
 */
export interface IPushProvider {
  /**
   * Send a push notification to a device
   *
   * @param deviceToken - Device token or subscription endpoint
   * @param payload - Push notification payload
   * @param options - Additional options
   * @returns Push send result with messageId and status
   * @throws {Error} If push sending fails
   */
  sendPush(
    deviceToken: string,
    payload: PushNotificationPayload,
    options?: {
      ttl?: number; // Time to live in seconds
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
      topic?: string;
    }
  ): Promise<PushSendResult>;

  /**
   * Send push to multiple devices
   *
   * @param deviceTokens - Array of device tokens
   * @param payload - Push notification payload
   * @param options - Additional options
   * @returns Array of send results
   */
  sendBulkPush(
    deviceTokens: string[],
    payload: PushNotificationPayload,
    options?: {
      ttl?: number;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
    }
  ): Promise<PushSendResult[]>;

  /**
   * Validate device token format
   *
   * @param deviceToken - Token to validate
   * @returns True if token appears valid
   */
  validateDeviceToken(deviceToken: string): boolean;

  /**
   * Test push provider connectivity
   *
   * @returns True if provider is accessible and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider name
   *
   * @returns Name of the push provider (web-push, FCM, APNs, etc.)
   */
  getProviderName(): string;
}
