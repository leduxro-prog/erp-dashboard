/**
 * WhatsApp Business API Provider
 * Implements IWhatsAppProvider using WhatsApp Business Platform
 */
import { Logger } from 'winston';
import { IWhatsAppProvider, WhatsAppSendResult, WhatsAppButton } from '../../application/ports/IWhatsAppProvider';

/**
 * WhatsApp Business API implementation of IWhatsAppProvider
 */
export class WhatsAppBusinessProvider implements IWhatsAppProvider {
  private logger: Logger;
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion: string = 'v18.0';

  constructor(
    logger: Logger,
    config: {
      phoneNumberId: string;
      accessToken: string;
      apiVersion?: string;
    }
  ) {
    this.logger = logger;
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    if (config.apiVersion) {
      this.apiVersion = config.apiVersion;
    }
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    templateLanguage: string,
    templateData: Record<string, unknown>,
    options?: {
      buttons?: WhatsAppButton[];
      headerText?: string;
      footerText?: string;
    }
  ): Promise<WhatsAppSendResult> {
    try {
      // TODO: Implement WhatsApp Business API call
      // const url = `https://graph.instagram.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
      // const payload = {
      //   messaging_product: 'whatsapp',
      //   to,
      //   type: 'template',
      //   template: {
      //     name: templateName,
      //     language: { code: templateLanguage },
      //     components: [
      //       {
      //         type: 'body',
      //         parameters: Object.values(templateData).map(v => ({ type: 'text', text: String(v) })),
      //       },
      //     ],
      //   },
      // };

      this.logger.debug('WhatsApp template message would be sent (stub)', {
        to,
        templateName,
      });

      return {
        messageId: `stub_${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send WhatsApp template message', {
        to,
        templateName,
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

  async sendTextMessage(
    to: string,
    body: string,
    options?: {
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'document' | 'audio';
      caption?: string;
    }
  ): Promise<WhatsAppSendResult> {
    try {
      // TODO: Implement WhatsApp Business API call
      this.logger.debug('WhatsApp text message would be sent (stub)', {
        to,
        bodyLength: body.length,
      });

      return {
        messageId: `stub_${Date.now()}`,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send WhatsApp text message', {
        to,
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

  async getTemplates(): Promise<string[]> {
    // TODO: Fetch from WhatsApp Business API
    return [];
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    // International format: +[country code][number]
    const regex = /^\+[1-9]\d{1,14}$/;
    return regex.test(phoneNumber);
  }

  async isAvailable(): Promise<boolean> {
    // TODO: Test WhatsApp API connectivity
    this.logger.debug('WhatsApp Business provider availability check (stub)');
    return true;
  }

  getProviderName(): string {
    return 'WhatsApp Business API';
  }
}
