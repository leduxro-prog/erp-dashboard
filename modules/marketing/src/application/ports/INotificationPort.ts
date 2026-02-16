/**
 * Notification Port Interface
 * Outbound port for sending notifications
 *
 * @module Application/Ports
 */

/**
 * INotificationPort
 * Port interface for sending emails and notifications
 * Implemented by external services (notifications module)
 */
export interface INotificationPort {
  /**
   * Send an email notification
   *
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param body - Email body (HTML)
   * @param trackingId - Unique ID for tracking opens/clicks
   * @param customerId - Customer ID for correlation
   * @returns Promise that resolves when email is queued
   */
  sendEmail(
    to: string,
    subject: string,
    body: string,
    trackingId: string,
    customerId: string
  ): Promise<void>;
}
