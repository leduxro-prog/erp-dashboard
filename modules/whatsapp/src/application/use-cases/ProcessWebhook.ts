/**
 * Process Webhook Use-Case
 *
 * Processes incoming webhook events from WhatsApp Business API.
 * Handles message reception, status updates, and template status changes.
 * Ensures idempotent processing via deduplication keys.
 *
 * @module whatsapp/application/use-cases
 */

import { IWebhookRepository } from '../../domain/repositories/IWebhookRepository';
import { IMessageRepository } from '../../domain/repositories/IMessageRepository';
import { IConversationRepository } from '../../domain/repositories/IConversationRepository';
import { WhatsAppWebhookEvent, WebhookEventType } from '../../domain/entities/WhatsAppWebhookEvent';
import { WhatsAppMessage } from '../../domain/entities/WhatsAppMessage';
import { WhatsAppConversation } from '../../domain/entities/WhatsAppConversation';

/**
 * Process webhook request DTO.
 */
export interface ProcessWebhookRequest {
  /** Type of webhook event */
  eventType: string;
  /** Event payload from Meta API */
  payload: Record<string, unknown>;
  /** Unique idempotency key for deduplication */
  idempotencyKey: string;
}

/**
 * Process webhook response DTO.
 */
export interface ProcessWebhookResponse {
  eventId: string;
  status: 'processed' | 'duplicate' | 'failed';
  message?: string;
}

/**
 * Process Webhook Use-Case.
 *
 * Application service for processing incoming WhatsApp webhook events.
 * Handles idempotency, message creation, and conversation management.
 *
 * @class ProcessWebhook
 */
export class ProcessWebhook {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  /**
   * Execute the use-case.
   *
   * @param request - Process webhook request
   * @returns Promise resolving to processing result
   */
  async execute(request: ProcessWebhookRequest): Promise<ProcessWebhookResponse> {
    // Check idempotency - skip if already processed
    const existing = await this.webhookRepository.findByIdempotencyKey(request.idempotencyKey);
    if (existing) {
      return {
        eventId: existing.id,
        status: 'duplicate',
        message: 'Webhook event already processed',
      };
    }

    // Create and save webhook event
    const eventId = this.generateId();
    const event = new WhatsAppWebhookEvent(
      eventId,
      request.eventType as WebhookEventType,
      request.payload,
      request.idempotencyKey,
      new Date(),
    );

    await this.webhookRepository.save(event);

    try {
      // Process based on event type
      switch (request.eventType) {
        case 'MESSAGE_RECEIVED':
          await this.handleMessageReceived(request.payload);
          break;
        case 'MESSAGE_STATUS':
          await this.handleMessageStatus(request.payload);
          break;
        default:
          // Unknown event types are saved but not processed
          break;
      }

      event.markProcessed();
      await this.webhookRepository.save(event);

      return {
        eventId,
        status: 'processed',
      };
    } catch (error) {
      event.markFailed(String(error));
      await this.webhookRepository.save(event);

      return {
        eventId,
        status: 'failed',
        message: String(error),
      };
    }
  }

  /**
   * Handle an incoming message from a customer.
   * Creates the inbound message and finds/creates the conversation.
   *
   * @param payload - Event payload
   */
  private async handleMessageReceived(payload: Record<string, unknown>): Promise<void> {
    const senderPhone = (payload.from as string) || '';
    const content = (payload.text as string) || '';
    const whatsappMessageId = (payload.whatsapp_message_id as string) || '';
    const customerName = (payload.customer_name as string) || 'Unknown Customer';

    // Find or create conversation
    let conversation = await this.conversationRepository.findByPhone(senderPhone);

    if (!conversation) {
      conversation = new WhatsAppConversation(
        this.generateId(),
        null,
        customerName,
        senderPhone,
        'OPEN',
        new Date(),
        new Date(),
      );
      conversation = await this.conversationRepository.save(conversation);
    } else if (!conversation.isActive()) {
      // Reopen resolved conversations on new inbound message
      conversation.reopen();
    }

    // Create inbound message
    const message = new WhatsAppMessage(
      this.generateId(),
      conversation.id,
      'INBOUND',
      'TEXT',
      '',
      senderPhone,
      content,
      'DELIVERED',
      new Date(),
      new Date(),
      undefined,
      undefined,
      undefined,
      undefined,
      whatsappMessageId,
    );

    await this.messageRepository.save(message);

    // Update conversation message count
    conversation.addMessage();
    await this.conversationRepository.save(conversation);
  }

  /**
   * Handle a message status update.
   * Updates the status of an outbound message (sent, delivered, read, failed).
   *
   * @param payload - Event payload
   */
  private async handleMessageStatus(payload: Record<string, unknown>): Promise<void> {
    const whatsappMessageId = (payload.whatsapp_message_id as string) || '';
    const status = (payload.status as string) || '';

    if (!whatsappMessageId) {
      return;
    }

    // Find message by WhatsApp message ID — search in pending messages
    const pendingMessages = await this.messageRepository.findPending(100);
    const message = pendingMessages.find((m) => m.getWhatsAppMessageId() === whatsappMessageId);

    if (!message) {
      return; // Message not found, skip silently
    }

    // Update message status based on webhook status
    switch (status.toUpperCase()) {
      case 'SENT':
        message.markSent(whatsappMessageId);
        break;
      case 'DELIVERED':
        message.markDelivered();
        break;
      case 'READ':
        message.markRead();
        break;
      case 'FAILED': {
        const reason = (payload.error_message as string) || 'Unknown failure';
        message.markFailed(reason);
        break;
      }
    }

    await this.messageRepository.save(message);
  }

  /**
   * Generate unique ID.
   * @internal
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
