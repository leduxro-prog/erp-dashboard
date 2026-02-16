/**
 * Email Provider Port (Interface)
 * Defines contract for email sending implementations (SMTP, SendGrid, etc.)
 *
 * @interface IEmailProvider
 */

export interface EmailSendResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
  timestamp: Date;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Port interface for email sending
 * Implementations provide SMTP or third-party email service integration
 */
export interface IEmailProvider {
  /**
   * Send an email
   *
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param html - HTML email body
   * @param options - Additional options
   * @returns Email send result with messageId and status
   * @throws {Error} If email sending fails
   */
  sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      from?: string;
      fromName?: string;
      cc?: string[];
      bcc?: string[];
      text?: string;
      attachments?: EmailAttachment[];
      replyTo?: string;
      headers?: Record<string, string>;
    }
  ): Promise<EmailSendResult>;

  /**
   * Send email to multiple recipients
   *
   * @param recipients - Array of recipient email addresses
   * @param subject - Email subject
   * @param html - HTML email body
   * @param options - Additional options
   * @returns Array of send results
   */
  sendBulk(
    recipients: string[],
    subject: string,
    html: string,
    options?: {
      from?: string;
      fromName?: string;
      text?: string;
      attachments?: EmailAttachment[];
    }
  ): Promise<EmailSendResult[]>;

  /**
   * Test email provider connectivity
   *
   * @returns True if provider is accessible and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider name
   *
   * @returns Name of the email provider (SMTP, SendGrid, etc.)
   */
  getProviderName(): string;
}
