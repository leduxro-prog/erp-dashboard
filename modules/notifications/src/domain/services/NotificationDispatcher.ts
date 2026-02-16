/**
 * Notification Dispatcher Domain Service
 * Routes notifications to appropriate channel providers based on channel type
 *
 * This is a domain service that orchestrates notification delivery across multiple providers.
 * No I/O or repository access - purely domain logic.
 *
 * @class NotificationDispatcher
 */
import { Notification, NotificationChannel } from '../entities/Notification';
import { Logger } from 'winston';

/**
 * Provider interface for notification dispatch
 * Implemented by infrastructure layer providers
 */
export interface IChannelProvider {
  channel: NotificationChannel;
  send(notification: Notification): Promise<{ messageId: string; status: string }>;
}

export class NotificationDispatcher {
  private providers: Map<NotificationChannel, IChannelProvider> = new Map();
  private logger: Logger;

  /**
   * Create a new NotificationDispatcher
   *
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a provider for a channel
   *
   * @param provider - Channel provider implementation
   * @throws {Error} If provider is already registered for channel
   */
  registerProvider(provider: IChannelProvider): void {
    if (this.providers.has(provider.channel)) {
      throw new Error(
        `Provider already registered for channel: ${provider.channel}`
      );
    }
    this.providers.set(provider.channel, provider);
    this.logger.debug(`Provider registered for channel: ${provider.channel}`);
  }

  /**
   * Get provider for a channel
   *
   * @param channel - Notification channel
   * @returns Provider for the channel
   * @throws {Error} If no provider registered for channel
   */
  getProviderForChannel(channel: NotificationChannel): IChannelProvider {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`No provider registered for channel: ${channel}`);
    }
    return provider;
  }

  /**
   * Dispatch a single notification through appropriate provider
   *
   * @param notification - Notification to dispatch
   * @returns Provider response with messageId and status
   * @throws {Error} If no provider for channel or dispatch fails
   */
  async dispatch(
    notification: Notification
  ): Promise<{ messageId: string; status: string }> {
    const provider = this.getProviderForChannel(notification.channel);

    this.logger.debug(`Dispatching notification to channel: ${notification.channel}`, {
      notificationId: notification.id,
      recipientId: notification.recipientId,
    });

    try {
      const result = await provider.send(notification);

      this.logger.debug(`Notification dispatched successfully`, {
        notificationId: notification.id,
        messageId: result.messageId,
        status: result.status,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to dispatch notification`, {
        notificationId: notification.id,
        channel: notification.channel,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Check if provider exists for channel
   *
   * @param channel - Notification channel
   * @returns True if provider is registered
   */
  hasProviderForChannel(channel: NotificationChannel): boolean {
    return this.providers.has(channel);
  }

  /**
   * Get all registered channels
   *
   * @returns Array of registered channel names
   */
  getRegisteredChannels(): NotificationChannel[] {
    return Array.from(this.providers.keys());
  }
}
