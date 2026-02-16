import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { SendMessage } from '../../application/use-cases/SendMessage';
import { ListMessages } from '../../application/use-cases/ListMessages';
import { ListConversations } from '../../application/use-cases/ListConversations';
import { GetConversation } from '../../application/use-cases/GetConversation';
import { AssignConversation } from '../../application/use-cases/AssignConversation';
import { ResolveConversation } from '../../application/use-cases/ResolveConversation';
import { ProcessWebhook } from '../../application/use-cases/ProcessWebhook';
import { ListTemplates } from '../../application/use-cases/ListTemplates';
import { CreateTemplate } from '../../application/use-cases/CreateTemplate';

// NEW USE CASES IMPORTS
import { ReopenConversation } from '../../application/use-cases/ReopenConversation';
import { MarkConversationAsRead } from '../../application/use-cases/MarkConversationAsRead';
import { UpdateTemplate } from '../../application/use-cases/UpdateTemplate';
import { DeleteTemplate } from '../../application/use-cases/DeleteTemplate';
import { GetAgents } from '../../application/use-cases/GetAgents';
import { SetAgentStatus } from '../../application/use-cases/SetAgentStatus';
import { GetConnectionStatus } from '../../application/use-cases/GetConnectionStatus';
import { ConnectWhatsApp } from '../../application/use-cases/ConnectWhatsApp';
import { DisconnectWhatsApp } from '../../application/use-cases/DisconnectWhatsApp';
import { ReconnectWhatsApp } from '../../application/use-cases/ReconnectWhatsApp';
import { GetTags } from '../../application/use-cases/GetTags';
import { UpdateConversationTags } from '../../application/use-cases/UpdateConversationTags';
import { GetStatistics } from '../../application/use-cases/GetStatistics';

/**
 * WhatsApp Controller
 * Handles all WhatsApp messaging, conversation, and template management operations
 */
export class WhatsAppController {
  constructor(
    private readonly sendMessageUseCase: SendMessage,
    private readonly listMessagesUseCase: ListMessages,
    private readonly listConversationsUseCase: ListConversations,
    private readonly getConversationUseCase: GetConversation,
    private readonly assignConversationUseCase: AssignConversation,
    private readonly resolveConversationUseCase: ResolveConversation,
    private readonly processWebhookUseCase: ProcessWebhook,
    private readonly listTemplatesUseCase: ListTemplates,
    private readonly createTemplateUseCase: CreateTemplate,
    // NEW USE CASES
    private readonly reopenConversationUseCase: ReopenConversation,
    private readonly markConversationAsReadUseCase: MarkConversationAsRead,
    private readonly updateTemplateUseCase: UpdateTemplate,
    private readonly deleteTemplateUseCase: DeleteTemplate,
    private readonly getAgentsUseCase: GetAgents,
    private readonly setAgentStatusUseCase: SetAgentStatus,
    private readonly getConnectionStatusUseCase: GetConnectionStatus,
    private readonly connectWhatsAppUseCase: ConnectWhatsApp,
    private readonly disconnectWhatsAppUseCase: DisconnectWhatsApp,
    private readonly reconnectWhatsAppUseCase: ReconnectWhatsApp,
    private readonly getTagsUseCase: GetTags,
    private readonly updateConversationTagsUseCase: UpdateConversationTags,
    private readonly getStatisticsUseCase: GetStatistics,
  ) {}

  /**
   * Send a WhatsApp message
   *
   * @param req - Express request with validated message data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with sent message details
   */
  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        recipient_phone,
        message_type,
        content,
        media_url,
        template_name,
        template_params,
        metadata,
      } = req.body;
      const _senderId = req.user?.id;

      const result = await this.sendMessageUseCase.execute({
        phone: recipient_phone,
        messageType: message_type,
        content,
        mediaUrl: media_url,
        templateName: template_name,
        parameters: template_params,
      } as any);

      res.status(201).json({
        success: true,
        data: {
          message_id: result.messageId,
          recipient_phone,
          message_type,
          status: result.status,
          sent_at: result.timestamp,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List messages with optional filtering
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of messages
   */
  async listMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        conversation_id,
        phone_number,
        status,
      } = req.validatedQuery as Record<string, any>;

      const result = await this.listMessagesUseCase.execute({
        conversationId: conversation_id,
        phone: phone_number,
        status,
        page: Number(page),
        limit: Number(limit),
      });

      const pageNum = Number(page);
      const limitNum = Number(limit);

      res.status(200).json({
        success: true,
        data: {
          messages: result.items.map((m) => ({
            message_id: m.id,
            conversation_id: m.conversationId,
            direction: m.direction,
            message_type: m.messageType,
            recipient_phone: m.recipientPhone,
            sender_phone: m.senderPhone,
            content: m.content,
            status: m.getStatus(),
            created_at: m.createdAt.toISOString(),
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            total_pages: Math.ceil(result.total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get message details by ID
   *
   * @param req - Express request with message ID param
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with message details
   */
  async getMessageDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      // Use listMessages with a broad query to find a specific message
      // The message repo doesn't have a direct getById exposed through use cases,
      // but the controller can return the found result
      const result = await this.listMessagesUseCase.execute({
        conversationId: id,
        page: 1,
        limit: 1,
      });

      if (result.items.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Message with id ${id} not found`,
            statusCode: 404,
          },
        });
        return;
      }

      const m = result.items[0];
      res.status(200).json({
        success: true,
        data: {
          message_id: m.id,
          conversation_id: m.conversationId,
          direction: m.direction,
          message_type: m.messageType,
          recipient_phone: m.recipientPhone,
          sender_phone: m.senderPhone,
          content: m.content,
          status: m.getStatus(),
          created_at: m.createdAt.toISOString(),
          whatsapp_message_id: m.getWhatsAppMessageId(),
          failure_reason: m.getFailureReason(),
          retry_count: m.getRetryCount(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle incoming webhook from WhatsApp
   * Processes incoming messages and status updates
   *
   * @param req - Express request with webhook payload
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns 200 OK status to acknowledge receipt
   */
  async handleWebhook(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { object, entry } = req.validatedBody as Record<string, any>;

      // Extract event details from Meta webhook format
      const entries = Array.isArray(entry) ? entry : [entry];
      for (const e of entries) {
        const changes = e?.changes || [];
        for (const change of changes) {
          const value = change?.value || {};
          const messages = value?.messages || [];
          const statuses = value?.statuses || [];

          // Process incoming messages
          for (const msg of messages) {
            await this.processWebhookUseCase.execute({
              eventType: 'MESSAGE_RECEIVED',
              payload: {
                from: msg.from,
                text: msg.text?.body || '',
                whatsapp_message_id: msg.id,
                customer_name: value?.contacts?.[0]?.profile?.name || 'Unknown',
              },
              idempotencyKey: msg.id || `msg-${Date.now()}`,
            });
          }

          // Process status updates
          for (const st of statuses) {
            await this.processWebhookUseCase.execute({
              eventType: 'MESSAGE_STATUS',
              payload: {
                whatsapp_message_id: st.id,
                status: st.status,
                error_message: st.errors?.[0]?.message,
              },
              idempotencyKey: `status-${st.id}-${st.status}`,
            });
          }
        }
      }

      // WhatsApp requires a 200 OK response within 30 seconds
      res.status(200).json({
        success: true,
        message: 'Webhook received and processed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List conversations
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of conversations
   */
  async listConversations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        assigned_to,
        search,
      } = req.validatedQuery as Record<string, any>;

      const result = await this.listConversationsUseCase.execute({
        status,
        assignedTo: assigned_to,
        search,
        page: Number(page),
        limit: Number(limit),
      });

      const pageNum = Number(page);
      const limitNum = Number(limit);

      res.status(200).json({
        success: true,
        data: {
          conversations: result.items.map((c) => ({
            conversation_id: c.id,
            customer_name: c.customerName,
            customer_phone: c.customerPhone,
            status: c.getStatus(),
            assigned_to: c.getAssignedToUserId(),
            message_count: c.getMessageCount(),
            unread_count: c.getUnreadCount(),
            priority: c.getPriority(),
            tags: c.getTags(),
            last_message_at: c.getLastMessageAt()?.toISOString(),
            created_at: c.createdAt.toISOString(),
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            total_pages: Math.ceil(result.total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get conversation details by ID
   *
   * @param req - Express request with conversation ID param
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with conversation details and message history
   */
  async getConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.getConversationUseCase.execute({
        conversationId: id,
      });

      const c = result.conversation;
      res.status(200).json({
        success: true,
        data: {
          conversation_id: c.id,
          customer_name: c.customerName,
          customer_phone: c.customerPhone,
          customer_id: c.getCustomerId(),
          status: c.getStatus(),
          assigned_to: c.getAssignedToUserId(),
          message_count: c.getMessageCount(),
          unread_count: c.getUnreadCount(),
          priority: c.getPriority(),
          tags: c.getTags(),
          last_message_at: c.getLastMessageAt()?.toISOString(),
          created_at: c.createdAt.toISOString(),
          messages: result.messages.map((m) => ({
            message_id: m.id,
            direction: m.direction,
            message_type: m.messageType,
            content: m.content,
            status: m.getStatus(),
            created_at: m.createdAt.toISOString(),
          })),
          total_messages: result.totalMessages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign conversation to an agent/supervisor
   *
   * @param req - Express request with conversation ID and assignment details
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with assignment confirmation
   */
  async assignConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { assigned_to, priority, notes } = req.validatedBody as Record<string, any>;

      const result = await this.assignConversationUseCase.execute({
        conversationId: id,
        userId: assigned_to,
        notes,
      });

      const c = result.conversation;
      res.status(200).json({
        success: true,
        data: {
          conversation_id: c.id,
          assigned_to: c.getAssignedToUserId(),
          status: c.getStatus(),
          assigned_at: result.assignedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve a conversation
   *
   * @param req - Express request with conversation ID and resolution details
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with resolution confirmation
   */
  async resolveConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { resolution_notes } = req.validatedBody as Record<string, any>;

      const result = await this.resolveConversationUseCase.execute({
        conversationId: id,
        resolutionNotes: resolution_notes,
      });

      const c = result.conversation;
      res.status(200).json({
        success: true,
        data: {
          conversation_id: c.id,
          status: c.getStatus(),
          resolved_at: result.resolvedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List message templates
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of templates
   */
  async listTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        status,
      } = req.validatedQuery as Record<string, any>;

      const result = await this.listTemplatesUseCase.execute({
        status,
        search,
        page: Number(page),
        limit: Number(limit),
      });

      const pageNum = Number(page);
      const limitNum = Number(limit);

      res.status(200).json({
        success: true,
        data: {
          templates: result.items.map((t) => ({
            template_id: t.id,
            template_name: t.name,
            language: t.language,
            category: t.category,
            status: t.getStatus(),
            body_text: t.bodyText,
            header_type: t.headerType,
            footer_text: t.footerText,
            parameters: t.parameters,
            usage_count: t.getUsageCount(),
            created_at: t.createdAt.toISOString(),
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.total,
            total_pages: Math.ceil(result.total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new message template (admin only)
   *
   * @param req - Express request with validated template data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with created template details
   */
  async createTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { template_name, category, content, parameters, language } =
        req.validatedBody as Record<string, any>;

      const template = await this.createTemplateUseCase.execute({
        name: template_name,
        content,
        category,
        language,
        parameters,
      });

      res.status(201).json({
        success: true,
        data: {
          template_id: template.id,
          template_name: template.name,
          category: template.category,
          language: template.language,
          status: template.getStatus(),
          body_text: template.bodyText,
          created_at: template.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── NEW ENDPOINTS ──────────────────

  /**
   * Reopen a resolved conversation
   *
   * @param req - Express request with conversation ID param
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with reopen confirmation
   */
  async reopenConversation(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.reopenConversationUseCase.execute({
        conversationId: id,
      });

      res.status(200).json({
        success: true,
        data: {
          conversation_id: result.conversationId,
          reopened_at: result.reopenedAt,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark conversation as read
   *
   * @param req - Express request with conversation ID param
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with mark read confirmation
   */
  async markConversationAsRead(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.markConversationAsReadUseCase.execute({
        conversationId: id,
      });

      res.status(200).json({
        success: true,
        data: {
          conversation_id: result.conversationId,
          marked_at: result.markedAt,
          previous_unread_count: result.previousUnreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing template
   *
   * @param req - Express request with template data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with updated template details
   */
  async updateTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { template_name, category, body, footer_text } = req.validatedBody as Record<
        string,
        any
      >;

      const result = await this.updateTemplateUseCase.execute({
        id,
        name: template_name,
        body,
        footerText: footer_text,
      });

      res.status(200).json({
        success: true,
        data: {
          template_id: result.template.id,
          template_name: result.template.name,
          category: result.template.category,
          language: result.template.language,
          status: result.template.getStatus(),
          body_text: result.template.bodyText,
          updated_at: result.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a template
   *
   * @param req - Express request with template ID param
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with delete confirmation
   */
  async deleteTemplate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.deleteTemplateUseCase.execute({
        id,
      });

      res.status(200).json({
        success: true,
        data: {
          template_id: result.templateId,
          deleted_at: result.deletedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all support agents
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with agents list
   */
  async getAgents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getAgentsUseCase.execute({
        status: req.query.status as any,
        search: req.query.search as string,
      });

      res.status(200).json({
        success: true,
        data: {
          agents: result.agents,
          stats: result.stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set agent availability status
   *
   * @param req - Express request with agent ID and status
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with status update confirmation
   */
  async setAgentStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { agentId } = req.params;
      const { status } = req.validatedBody as Record<string, any>;

      const result = await this.setAgentStatusUseCase.execute({
        agentId,
        status,
      });

      res.status(200).json({
        success: true,
        data: {
          agent_id: result.agentId,
          status: result.status,
          updated_at: result.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get WhatsApp connection status
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with connection status
   */
  async getConnectionStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await this.getConnectionStatusUseCase.execute();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Connect WhatsApp (generate QR code)
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with QR code
   */
  async connectWhatsApp(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await this.connectWhatsAppUseCase.execute({
        force: req.body.force as boolean,
      });

      res.status(200).json({
        success: true,
        data: {
          qr_code: result.qrCode,
          expires_in: result.expiresIn,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect WhatsApp
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with disconnect confirmation
   */
  async disconnectWhatsApp(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await this.disconnectWhatsAppUseCase.execute();

      res.status(200).json({
        success: true,
        data: {
          disconnected_at: result.disconnectedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reconnect WhatsApp (force new QR code)
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with QR code
   */
  async reconnectWhatsApp(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await this.reconnectWhatsAppUseCase.execute({});

      res.status(200).json({
        success: true,
        data: {
          qr_code: result.qrCode,
          expires_in: result.expiresIn,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all tags
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with tags list
   */
  async getTags(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getTagsUseCase.execute();

      res.status(200).json({
        success: true,
        data: {
          tags: result.tags,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update conversation tags
   *
   * @param req - Express request with conversation ID and tag IDs
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with tags update confirmation
   */
  async updateConversationTags(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { tag_ids } = req.validatedBody as Record<string, any>;

      const result = await this.updateConversationTagsUseCase.execute({
        conversationId: id,
        tagIds: tag_ids || [],
      });

      res.status(200).json({
        success: true,
        data: {
          conversation_id: result.conversationId,
          tags: result.tags,
          updated_at: result.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get WhatsApp statistics
   *
   * @param req - Express request with date range query
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with statistics
   */
  async getStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getStatisticsUseCase.execute({
        dateFrom: req.query.date_from as string,
        dateTo: req.query.date_to as string,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
