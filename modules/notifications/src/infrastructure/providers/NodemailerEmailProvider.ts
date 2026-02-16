/**
 * Nodemailer Email Provider
 * Implements IEmailProvider using Nodemailer SMTP
 */
import * as nodemailer from 'nodemailer';
import { Logger } from 'winston';
import { IEmailProvider, EmailSendResult, EmailAttachment } from '../../application/ports/IEmailProvider';

/**
 * Nodemailer implementation of IEmailProvider
 * Sends emails via configured SMTP server
 */
export class NodemailerEmailProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter;
  private logger: Logger;
  private defaultFrom: string;
  private defaultFromName: string;

  constructor(
    logger: Logger,
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
      from: string;
      fromName?: string;
    }
  ) {
    this.logger = logger;
    this.defaultFrom = smtpConfig.from;
    this.defaultFromName = smtpConfig.fromName || 'CYPHER ERP';

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });
  }

  async sendEmail(
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
  ): Promise<EmailSendResult> {
    try {
      const mailOptions = {
        from: options?.from || this.defaultFrom,
        to,
        subject,
        html,
        text: options?.text,
        cc: options?.cc,
        bcc: options?.bcc,
        replyTo: options?.replyTo,
        headers: options?.headers,
        attachments: options?.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.debug('Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
      });

      return {
        messageId: info.messageId || info.response,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send email', {
        to,
        subject,
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

  async sendBulk(
    recipients: string[],
    subject: string,
    html: string,
    options?: {
      from?: string;
      fromName?: string;
      text?: string;
      attachments?: EmailAttachment[];
    }
  ): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, html, options);
      results.push(result);
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.debug('Nodemailer email provider is available');
      return true;
    } catch (error) {
      this.logger.error('Nodemailer email provider is not available', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  getProviderName(): string {
    return 'Nodemailer SMTP';
  }
}
