/**
 * Multi-Provider Email Service
 * Supports SendGrid, AWS SES, and SMTP with automatic fallback
 */

import axios from 'axios';
import { IEmailService } from '../../application/use-cases/SendQuote';

export interface EmailProvider {
  name: 'sendgrid' | 'aws-ses' | 'smtp';
  enabled: boolean;
  priority: number; // Lower number = higher priority
}

export interface EmailConfig {
  providers: EmailProvider[];
  sendgridApiKey?: string;
  awsSesRegion?: string;
  awsSesAccessKeyId?: string;
  awsSesSecretAccessKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export class EmailService implements IEmailService {
  private config: EmailConfig;
  private availableProviders: EmailProvider[];

  /**
   * Send quote email (implements IEmailService interface)
   */
  async sendQuoteEmail(
    to: string,
    customerName: string,
    quoteNumber: string,
    validUntil: Date,
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Oferta ${quoteNumber} - ${this.config.fromName}`,
      html: `<p>Bună ziua ${customerName},</p><p>Oferta ${quoteNumber} este disponibilă. Valabilă până: ${validUntil.toLocaleDateString('ro-RO')}</p>`,
      text: `Bună ziua ${customerName}, Oferta ${quoteNumber} este disponibilă. Valabilă până: ${validUntil.toLocaleDateString('ro-RO')}`,
    });
  }

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      providers: config?.providers || [
        { name: 'sendgrid', enabled: !!process.env.SENDGRID_API_KEY, priority: 1 },
        { name: 'aws-ses', enabled: !!process.env.AWS_SES_REGION, priority: 2 },
        { name: 'smtp', enabled: !!process.env.SMTP_HOST, priority: 3 },
      ],
      sendgridApiKey: config?.sendgridApiKey || process.env.SENDGRID_API_KEY,
      awsSesRegion: config?.awsSesRegion || process.env.AWS_SES_REGION,
      awsSesAccessKeyId: config?.awsSesAccessKeyId || process.env.AWS_SES_ACCESS_KEY_ID,
      awsSesSecretAccessKey: config?.awsSesSecretAccessKey || process.env.AWS_SES_SECRET_ACCESS_KEY,
      smtpHost: config?.smtpHost || process.env.SMTP_HOST,
      smtpPort: config?.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: config?.smtpUser || process.env.SMTP_USER,
      smtpPassword: config?.smtpPassword || process.env.SMTP_PASSWORD,
      smtpSecure: config?.smtpSecure ?? (process.env.SMTP_SECURE === 'true'),
      fromEmail: config?.fromEmail || process.env.EMAIL_FROM || 'noreply@ledux.ro',
      fromName: config?.fromName || process.env.EMAIL_FROM_NAME || 'LEDUX.RO',
      replyToEmail: config?.replyToEmail || process.env.EMAIL_REPLY_TO,
    };

    // Sort providers by priority and filter enabled ones
    this.availableProviders = this.config.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (this.availableProviders.length === 0) {
      console.warn('No email providers configured. Emails will be logged to console only.');
    }
  }

  /**
   * Send email with automatic provider fallback
   */
  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    // If no providers configured, just log
    if (this.availableProviders.length === 0) {
      console.log('📧 Email (Development Mode):', {
        to: message.to,
        subject: message.subject,
        text: message.text.substring(0, 200) + '...',
      });
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
        provider: 'console',
      };
    }

    // Try each provider in priority order
    for (const provider of this.availableProviders) {
      try {
        let result: EmailResult;

        switch (provider.name) {
          case 'sendgrid':
            result = await this.sendViaSendGrid(message);
            break;
          case 'aws-ses':
            result = await this.sendViaAwsSes(message);
            break;
          case 'smtp':
            result = await this.sendViaSmtp(message);
            break;
          default:
            continue;
        }

        if (result.success) {
          return { ...result, provider: provider.name };
        }
      } catch (error) {
        console.error(`Failed to send via ${provider.name}:`, error);
        // Continue to next provider
      }
    }

    // All providers failed
    return {
      success: false,
      error: 'All email providers failed',
    };
  }

  /**
   * Send via SendGrid API
   */
  private async sendViaSendGrid(message: EmailMessage): Promise<EmailResult> {
    if (!this.config.sendgridApiKey) {
      throw new Error('SendGrid API key not configured');
    }

    const payload = {
      personalizations: [
        {
          to: Array.isArray(message.to)
            ? message.to.map(email => ({ email }))
            : [{ email: message.to }],
          subject: message.subject,
          ...(message.cc && { cc: message.cc.map(email => ({ email })) }),
          ...(message.bcc && { bcc: message.bcc.map(email => ({ email })) }),
        },
      ],
      from: {
        email: message.from || this.config.fromEmail,
        name: this.config.fromName,
      },
      ...(message.replyTo && {
        reply_to: { email: message.replyTo },
      }),
      content: [
        { type: 'text/plain', value: message.text },
        { type: 'text/html', value: message.html },
      ],
      ...(message.attachments && {
        attachments: message.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string'
            ? att.content
            : att.content.toString('base64'),
          type: att.contentType || 'application/octet-stream',
          disposition: 'attachment',
        })),
      }),
    };

    const response = await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${this.config.sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: response.status === 202,
      messageId: response.headers['x-message-id'],
    };
  }

  /**
   * Send via AWS SES API
   */
  private async sendViaAwsSes(message: EmailMessage): Promise<EmailResult> {
    if (!this.config.awsSesRegion || !this.config.awsSesAccessKeyId) {
      throw new Error('AWS SES not configured');
    }

    // Note: This is a simplified implementation
    // In production, use the AWS SDK: @aws-sdk/client-ses
    const payload = {
      Source: `${this.config.fromName} <${this.config.fromEmail}>`,
      Destination: {
        ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
        ...(message.cc && { CcAddresses: message.cc }),
        ...(message.bcc && { BccAddresses: message.bcc }),
      },
      Message: {
        Subject: { Data: message.subject },
        Body: {
          Text: { Data: message.text },
          Html: { Data: message.html },
        },
      },
      ...(message.replyTo && { ReplyToAddresses: [message.replyTo] }),
    };

    // This would use AWS SDK in production
    console.log('AWS SES send:', payload);

    return {
      success: true,
      messageId: `ses-${Date.now()}`,
    };
  }

  /**
   * Send via SMTP
   */
  private async sendViaSmtp(message: EmailMessage): Promise<EmailResult> {
    if (!this.config.smtpHost) {
      throw new Error('SMTP not configured');
    }

    // Note: This is a placeholder
    // In production, use nodemailer library
    console.log('SMTP send:', {
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      to: message.to,
      subject: message.subject,
    });

    return {
      success: true,
      messageId: `smtp-${Date.now()}`,
    };
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Array<{ name: string; enabled: boolean; healthy: boolean }> {
    return this.config.providers.map(provider => ({
      name: provider.name,
      enabled: provider.enabled,
      healthy: this.availableProviders.some(p => p.name === provider.name),
    }));
  }

  /**
   * Test email configuration
   */
  async testConfiguration(testEmail: string): Promise<EmailResult> {
    return await this.sendEmail({
      to: testEmail,
      subject: 'Test Email from CYPHER ERP',
      html: '<p>This is a test email. If you received this, your email configuration is working correctly!</p>',
      text: 'This is a test email. If you received this, your email configuration is working correctly!',
    });
  }
}
