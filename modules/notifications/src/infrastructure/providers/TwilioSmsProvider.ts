/**
 * Twilio SMS Provider
 * Implements ISmsProvider using Twilio API (stub - ready for implementation)
 */
import { Logger } from 'winston';
import { ISmsProvider, SmsSendResult } from '../../application/ports/ISmsProvider';

/**
 * Twilio implementation of ISmsProvider (stub)
 * Ready to be connected to Twilio API
 */
export class TwilioSmsProvider implements ISmsProvider {
  private logger: Logger;
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(
    logger: Logger,
    config: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    }
  ) {
    this.logger = logger;
    this.accountSid = config.accountSid;
    this.authToken = config.authToken;
    this.fromNumber = config.fromNumber;
  }

  async sendSms(
    to: string,
    body: string,
    options?: {
      from?: string;
      messageType?: 'standard' | 'unicode' | 'flash';
      validity?: number;
      tags?: Record<string, string>;
    }
  ): Promise<SmsSendResult> {
    try {
      // TODO: Implement Twilio API call
      // const client = require('twilio')(this.accountSid, this.authToken);
      // const message = await client.messages.create({
      //   body,
      //   from: options?.from || this.fromNumber,
      //   to,
      // });

      this.logger.debug('SMS would be sent (stub)', {
        to,
        bodyLength: body.length,
      });

      return {
        messageId: `stub_${Date.now()}`,
        status: 'queued',
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to send SMS', {
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

  async sendBulk(
    recipients: string[],
    body: string,
    options?: {
      from?: string;
      messageType?: 'standard' | 'unicode' | 'flash';
    }
  ): Promise<SmsSendResult[]> {
    const results: SmsSendResult[] = [];

    for (const recipient of recipients) {
      const result = await this.sendSms(recipient, body, options);
      results.push(result);
    }

    return results;
  }

  getMessageInfo(body: string): { characterCount: number; messageParts: number } {
    const characterCount = body.length;
    // Standard SMS: 160 chars, Unicode SMS: 70 chars
    const isUnicode = /[^\x00-\x7F]/.test(body);
    const maxChars = isUnicode ? 70 : 160;
    const messageParts = Math.ceil(characterCount / maxChars);

    return {
      characterCount,
      messageParts,
    };
  }

  async isAvailable(): Promise<boolean> {
    // TODO: Test Twilio API connectivity
    this.logger.debug('Twilio SMS provider availability check (stub)');
    return true;
  }

  getProviderName(): string {
    return 'Twilio SMS';
  }
}
