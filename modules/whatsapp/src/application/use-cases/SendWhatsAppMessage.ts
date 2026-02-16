import { 
  IWhatsAppBusinessApi, 
  SendTextMessageRequest, 
  SendTemplateMessageRequest, 
  SendMediaMessageRequest 
} from '../../domain/ports/IWhatsAppBusinessApi';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('send-whatsapp-message');

export interface SendWhatsAppMessageInput {
  recipientPhone: string;
  messageType: 'text' | 'template' | 'image' | 'document';
  content?: string;
  templateName?: string;
  languageCode?: string;
  parameters?: string[];
  mediaUrl?: string;
  caption?: string;
}

export class SendWhatsAppMessage {
  constructor(private readonly whatsappApi: IWhatsAppBusinessApi) {}

  async execute(input: SendWhatsAppMessageInput) {
    logger.info('Executing WhatsApp send message', { 
      recipient: input.recipientPhone, 
      type: input.messageType 
    });

    // Normalize phone number (remove +, spaces, etc. - Meta expects digits only)
    const phone = input.recipientPhone.replace(/\D/g, '');

    switch (input.messageType) {
      case 'text':
        if (!input.content) throw new Error('Content is required for text message');
        return await this.whatsappApi.sendTextMessage({
          phone,
          text: input.content,
        });

      case 'template':
        if (!input.templateName) throw new Error('Template name is required');
        return await this.whatsappApi.sendTemplateMessage({
          phone,
          templateName: input.templateName,
          languageCode: input.languageCode,
          parameters: input.parameters,
        });

      case 'image':
      case 'document':
        if (!input.mediaUrl) throw new Error('Media URL is required');
        return await this.whatsappApi.sendMediaMessage({
          phone,
          mediaType: input.messageType as any,
          mediaUrl: input.mediaUrl,
          caption: input.caption,
        });

      default:
        throw new Error(`Unsupported message type: ${input.messageType}`);
    }
  }
}
