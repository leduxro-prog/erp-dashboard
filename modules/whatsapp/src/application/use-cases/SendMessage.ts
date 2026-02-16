/**
 * Send Message Use-Case
 *
 * Sends a text message to a customer via WhatsApp.
 * Creates or retrieves conversation and queues message for delivery.
 *
 * @module whatsapp/application/use-cases
 */

import { Logger } from 'winston';
import { WhatsAppMessage, MessageType } from '../../domain/entities/WhatsAppMessage';
import { WhatsAppConversation } from '../../domain/entities/WhatsAppConversation';
import { IMessageRepository } from '../../domain/repositories/IMessageRepository';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { IWhatsAppBusinessApi } from '../../domain/ports/IWhatsAppBusinessApi';
import { InvalidPhoneError, ConversationClosedError } from '../../domain/errors/whatsapp.errors';
import { ValidationError } from '@shared/errors';

/**
 * Send message request DTO.
 */
export interface SendMessageRequest {
  /** Recipient phone number (E.164 format) */
  phone: string;
  /** Message content */
  content?: string;
  /** Message type (default: TEXT) */
  type?: MessageType;
  /** Customer ID if known */
  customerId?: string;
  /** Customer name (required if customerId not provided) */
  customerName?: string;
  /** Template name if template message */
  templateName?: string;
  /** Template parameters */
  parameters?: string[];
  /** Media URL if media message */
  mediaUrl?: string;
}

/**
 * Send message response DTO.
 */
export interface SendMessageResponse {
  messageId: string;
  conversationId: string;
  status: 'queued' | 'pending';
  timestamp: Date;
}

/**
 * Send Message Use-Case.
 *
 * Application service for sending WhatsApp messages.
 * Orchestrates domain entities and repositories.
 *
 * @class SendMessage
 */
export class SendMessage {
  /**
   * Constructor.
   *
   * @param messageRepository - Message persistence repository
   * @param conversationRepository - Conversation persistence repository
   * @param whatsappApi - WhatsApp Business API client
   * @param logger - Logger instance
   */
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly whatsappApi: IWhatsAppBusinessApi,
    private readonly logger: Logger
  ) {}

  /**
   * Execute the use-case.
   *
   * @param request - Send message request
   * @returns Promise resolving to send message response
   * @throws {InvalidPhoneError} If phone format invalid
   * @throws {ValidationError} If required fields missing
   * @throws {ConversationClosedError} If conversation is resolved/archived
   * @throws {Error} On database or API errors
   */
  async execute(request: SendMessageRequest): Promise<SendMessageResponse> {
    this.logger.debug('SendMessage use-case started', { phone: request.phone });

    // Validate phone number
    this.validatePhoneNumber(request.phone);

    // Validate required fields
    if (!request.content || request.content.trim().length === 0) {
      throw new ValidationError('Message content is required');
    }

    if (request.content.length > 4096) {
      throw new ValidationError(
        'Message content exceeds maximum length',
        'Maximum 4096 characters allowed'
      );
    }

    // Get or create conversation
    let conversation = await this.conversationRepository.findByPhone(request.phone);

    if (!conversation) {
      conversation = new WhatsAppConversation(
        this.generateId(),
        request.customerId || null,
        request.customerName || 'Unknown Customer',
        request.phone,
        'OPEN',
        new Date(),
        new Date()
      );
      conversation = await this.conversationRepository.save(conversation);
      this.logger.info('Conversation created', { conversationId: conversation.id });
    }

    // Check if conversation is active
    if (!conversation.isActive()) {
      throw new ConversationClosedError(conversation.id, conversation.getStatus());
    }

    // Create message entity
    const messageId = this.generateId();
    const message = new WhatsAppMessage(
      messageId,
      conversation.id,
      'OUTBOUND',
      request.type || 'TEXT',
      request.phone,
      '+40xxx', // Business phone - from config
      request.content,
      'PENDING',
      new Date(),
      new Date()
    );

    // Save message to database
    await this.messageRepository.save(message);
    this.logger.info('Message saved to database', { messageId, conversationId: conversation.id });

    // Call WhatsApp API
    let apiResult;
    try {
      if (request.templateName) {
        apiResult = await this.whatsappApi.sendTemplateMessage({
          phone: request.phone.replace(/\D/g, ''),
          templateName: request.templateName,
          parameters: request.parameters,
        });
      } else if (request.type === 'IMAGE' || request.type === 'DOCUMENT' || request.type === 'VIDEO' || request.type === 'AUDIO') {
        apiResult = await this.whatsappApi.sendMediaMessage({
          phone: request.phone.replace(/\D/g, ''),
          mediaType: request.type.toLowerCase() as any,
          mediaUrl: request.mediaUrl!,
          caption: request.content,
        });
      } else {
        apiResult = await this.whatsappApi.sendTextMessage({
          phone: request.phone.replace(/\D/g, ''),
          text: request.content || '',
        });
      }

      // Update message with API result
      message.markSent(apiResult.messageId);
      await this.messageRepository.save(message);
    } catch (apiError) {
      this.logger.error('Failed to send message via WhatsApp API', { messageId, error: apiError });
      message.markFailed(String(apiError));
      await this.messageRepository.save(message);
      throw apiError;
    }

    // Update conversation with new message
    conversation.addMessage();
    await this.conversationRepository.save(conversation);

    // Publish message_sent event (handled by module)
    this.logger.info('SendMessage use-case completed', { messageId });

    return {
      messageId,
      conversationId: conversation.id,
      status: 'pending',
      timestamp: new Date(),
    };
  }

  /**
   * Validate phone number format.
   * @internal
   *
   * @param phone - Phone number to validate
   * @throws {InvalidPhoneError} If format invalid
   */
  private validatePhoneNumber(phone: string): void {
    // E.164 format: +[country code][number]
    // Example: +40723456789
    const e164Regex = /^\+[1-9]\d{1,14}$/;

    if (!e164Regex.test(phone)) {
      throw new InvalidPhoneError(phone);
    }
  }

  /**
   * Generate unique ID.
   * @internal
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
