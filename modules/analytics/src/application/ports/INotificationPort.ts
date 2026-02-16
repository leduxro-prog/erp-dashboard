/**
 * Notification Port (Outbound Adapter Interface)
 *
 * Hexagonal architecture port for sending notifications (email reports).
 * Implementations handle email delivery via external services.
 *
 * @interface INotificationPort
 */
export interface INotificationPort {
  /**
   * Send a report to recipients via email
   * Attaches report file and sends notification
   *
   * @param email - Email address to send to
   * @param reportBuffer - Report file content as Buffer
   * @param format - Report file format (affects content-type and filename)
   * @returns Promise that resolves when email is sent
   * @throws Error if email sending fails
   */
  sendReport(
    email: string,
    reportBuffer: Buffer,
    format: 'PDF' | 'EXCEL' | 'CSV'
  ): Promise<void>;
}
