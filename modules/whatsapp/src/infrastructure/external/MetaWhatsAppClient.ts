import axios, { AxiosInstance } from 'axios';
import { 
  IWhatsAppBusinessApi, 
  SendTextMessageRequest, 
  SendTemplateMessageRequest, 
  SendMediaMessageRequest, 
  MessageSendResponse, 
  TemplateStatusUpdate 
} from '../../domain/ports/IWhatsAppBusinessApi';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('meta-whatsapp-client');

export class MetaWhatsAppClient implements IWhatsAppBusinessApi {
  private axiosInstance: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string = 'v18.0';

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    
    this.axiosInstance = axios.create({
      baseURL: `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    if (!this.phoneNumberId || !this.accessToken) {
      logger.warn('WhatsApp Business API credentials missing. Client will fail calls.');
    }
  }

  async sendTextMessage(request: SendTextMessageRequest): Promise<MessageSendResponse> {
    try {
      logger.debug('Sending text message', { phone: request.phone });
      
      const response = await this.axiosInstance.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: request.phone,
        type: 'text',
        text: { body: request.text },
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.handleError('sendTextMessage', error);
    }
  }

  async sendTemplateMessage(request: SendTemplateMessageRequest): Promise<MessageSendResponse> {
    try {
      logger.debug('Sending template message', { phone: request.phone, template: request.templateName });

      const components: any[] = [];
      if (request.parameters && request.parameters.length > 0) {
        components.push({
          type: 'body',
          parameters: request.parameters.map(p => ({ type: 'text', text: p })),
        });
      }

      const response = await this.axiosInstance.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: request.phone,
        type: 'template',
        template: {
          name: request.templateName,
          language: { code: request.languageCode || 'ro' },
          components,
        },
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.handleError('sendTemplateMessage', error);
    }
  }

  async sendMediaMessage(request: SendMediaMessageRequest): Promise<MessageSendResponse> {
    try {
      logger.debug('Sending media message', { phone: request.phone, type: request.mediaType });

      const mediaPayload: any = {
        link: request.mediaUrl,
      };
      if (request.caption) {
        mediaPayload.caption = request.caption;
      }

      const response = await this.axiosInstance.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: request.phone,
        type: request.mediaType,
        [request.mediaType]: mediaPayload,
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
        timestamp: new Date(),
      };
    } catch (error: any) {
      this.handleError('sendMediaMessage', error);
    }
  }

  async getTemplateStatus(templateName: string, languageCode: string): Promise<TemplateStatusUpdate> {
    try {
      // Note: Template management is usually done at the WABA level, not Phone Number ID level
      const wabaId = process.env.WHATSAPP_WABA_ID;
      if (!wabaId) throw new Error('WHATSAPP_WABA_ID is required for template status');

      const response = await axios.get(
        `https://graph.facebook.com/${this.apiVersion}/${wabaId}/message_templates`,
        {
          params: { name: templateName },
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
        }
      );

      const template = response.data.data.find(
        (t: any) => t.name === templateName && t.language === languageCode
      );

      if (!template) throw new Error('Template not found');

      return {
        templateId: template.id,
        status: template.status as 'APPROVED' | 'PENDING' | 'REJECTED',
        rejectionReason: template.rejection_reason,
      };
    } catch (error: any) {
      this.handleError('getTemplateStatus', error);
    }
  }

  async markMessageRead(messageId: string): Promise<void> {
    try {
      await this.axiosInstance.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error: any) {
      this.handleError('markMessageRead', error);
    }
  }

  async uploadMedia(mediaType: string, mediaBuffer: Buffer, mimeType: string): Promise<string> {
    // Implement using FormData if needed
    throw new Error('Not implemented');
  }

  async healthCheck(): Promise<any> {
    try {
      // Simple call to check if token/phone ID is valid
      await this.axiosInstance.get('/');
      return {
        healthy: true,
        rateLimitRemaining: 100, // Placeholder
        rateLimitReset: new Date(),
      };
    } catch (error) {
      return { healthy: false };
    }
  }

  private handleError(operation: string, error: any): never {
    const message = error.response?.data?.error?.message || error.message;
    const code = error.response?.data?.error?.code;
    
    logger.error(`WhatsApp API Error (${operation})`, { 
      status: error.response?.status,
      message,
      code,
      details: error.response?.data
    });

    const err: any = new Error(`WhatsApp API Error: ${message}`);
    err.code = code;
    err.statusCode = error.response?.status;
    throw err;
  }
}
