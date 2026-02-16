/**
 * Web Push Notification Provider
 * Implements IPushProvider using web-push library
 */
import * as webpush from 'web-push';
import { Logger } from 'winston';
import { IPushProvider, PushSendResult, PushNotificationPayload } from '../../application/ports/IPushProvider';

/**
 * Web Push implementation of IPushProvider
 * Sends push notifications to web browsers
 */
export class WebPushProvider implements IPushProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    config?: {
      vapidPublicKey?: string;
      vapidPrivateKey?: string;
      vapidSubject?: string;
    }
  ) {
    this.logger = logger;

    if (config?.vapidPublicKey && config?.vapidPrivateKey) {
      webpush.setVapidDetails(
        config.vapidSubject || 'mailto:support@cyphererp.com',
        config.vapidPublicKey,
        config.vapidPrivateKey
      );
    }
  }

  async sendPush(
    deviceToken: string,
    payload: PushNotificationPayload,
    options?: {
      ttl?: number;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
      topic?: string;
    }
  ): Promise<PushSendResult> {
    try {
      // Parse device token (should be a valid subscription object)
      let subscription: webpush.PushSubscription;
      try {
        subscription = JSON.parse(deviceToken);
      } catch {
        subscription = {
          endpoint: deviceToken,
          keys: { p256dh: '', auth: '' },
        } as webpush.PushSubscription;
      }

      const notificationPayload = JSON.stringify(payload);

      const result = await webpush.sendNotification(
        subscription,
        notificationPayload,
        {
          TTL: options?.ttl || 24 * 60 * 60, // 24 hours default
          urgency: options?.urgency || 'normal',
          topic: options?.topic,
        }
      );

      this.logger.debug('Push notification sent successfully', {
        endpoint: subscription.endpoint,
        title: payload.title,
      });

      return {
        messageId: `push_${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send push notification', {
        error: message,
      });

      return {
        messageId: '',
        status: 'failed',
        error: message,
        timestamp: new Date(),
      };
    }
  }

  async sendBulkPush(
    deviceTokens: string[],
    payload: PushNotificationPayload,
    options?: {
      ttl?: number;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
    }
  ): Promise<PushSendResult[]> {
    const results: PushSendResult[] = [];

    for (const deviceToken of deviceTokens) {
      const result = await this.sendPush(deviceToken, payload, options);
      results.push(result);
    }

    return results;
  }

  validateDeviceToken(deviceToken: string): boolean {
    try {
      const subscription = JSON.parse(deviceToken);
      return !!(
        subscription.endpoint &&
        subscription.keys &&
        subscription.keys.p256dh &&
        subscription.keys.auth
      );
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    this.logger.debug('Web Push provider is available');
    return true;
  }

  getProviderName(): string {
    return 'Web Push (web-push library)';
  }
}
